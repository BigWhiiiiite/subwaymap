import Head from 'next/head';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Inter } from 'next/font/google';
import styles from '@/styles/Home.module.css';
import Grid from '@mui/material/Unstable_Grid2'; // Grid version 2
import { Autocomplete, TextField, Button, Typography, List, ListItem, ListItemText } from '@mui/material';
import mapImage from '../public/map.png';
import pathData from '@/toolkit/pathdata.json';
import * as React from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import stationPos from './stationPos.json';
import TouristAttraction from './TouristAttraction.json'

var graph = {};
var nameToId = {};
var lineInfo = {};

function buildGraph(pathData) {
    pathData.forEach(row => {
        const { id1, id2, name1, name2, length, line } = row;
        const lengthInt = parseInt(length);

        if (!(name1 in graph)) {
            graph[name1] = {};
        }
        if (!(name2 in graph)) {
            graph[name2] = {};
        }

        graph[name1][name2] = { length: lengthInt, line };
        graph[name2][name1] = { length: lengthInt, line };

        nameToId[name1] = id1;
        nameToId[name2] = id2;
        lineInfo[[name1, name2]] = line;
        lineInfo[[name2, name1]] = line;
    });

    return { graph, nameToId, lineInfo };
}

// 修改版的 Dijkstra 算法
function dijkstraModified(graph, startName, endName) {
    const distances = {};
    const times = {}; // 时间记录，单位为秒
    const paths = {};
    const pathLines = {}; // 路径线路信息
    const nodes = new Set(Object.keys(graph));
    const transferTime = 0.083; // 换乘时间代价 (5分钟)

    // 初始化节点的距离、时间、路径和线路信息
    for (let node of nodes) {
        distances[node] = Infinity;
        times[node] = Infinity; // 初始化时间为无穷大
        paths[node] = [];
        pathLines[node] = [];
    }
    distances[startName] = 0;
    times[startName] = 0; // 起始站的时间初始化为0
    paths[startName] = [startName];

    // 初始化起始站的线路信息为起始站自身的线路（如果有的话）
    if (graph[startName] && Object.values(graph[startName])[0]) {
        const startLine = Object.values(graph[startName])[0].line;
        pathLines[startName] = [startLine];
    } else {
        pathLines[startName] = [null];
    }

    while (nodes.size > 0) {
        let closestNode = null;
        let closestDistance = Infinity;

        for (let node of nodes) {
            if (distances[node] < closestDistance) {
                closestDistance = distances[node];
                closestNode = node;
            }
        }

        if (closestNode === null) break;

        nodes.delete(closestNode);

        const neighbors = graph[closestNode];
        for (let neighbor in neighbors) {
            const lastLine = pathLines[closestNode][pathLines[closestNode].length - 1];
            const newLine = neighbors[neighbor].line;
            const transferPenalty = lastLine !== null && lastLine !== newLine ? transferTime : 0; // 如果换乘，增加时间代价

            const newDistance = distances[closestNode] + neighbors[neighbor].length;
            const newTime = times[closestNode] + neighbors[neighbor].length / 80000 + transferPenalty;

            if (newDistance < distances[neighbor] || (newDistance === distances[neighbor] && newTime < times[neighbor])) {
                distances[neighbor] = newDistance;
                times[neighbor] = newTime; // 更新时间
                paths[neighbor] = [...paths[closestNode], neighbor];
                pathLines[neighbor] = [...pathLines[closestNode], newLine]; // 更新路径线路信息
            }
        }
    }

    // 在返回结果前，确保第一站的线路信息正确
    if (paths[endName].length > 1 && pathLines[endName][0] === null) {
        pathLines[endName][0] = graph[paths[endName][0]][paths[endName][1]].line;
    }

    return { distance: distances[endName], time: times[endName], path: paths[endName], lines: pathLines[endName] };
}

// 寻找最快路径的函数
function findFastestPath(graph, startName, endName, lineInfo) {
    const queue = [{ path: [startName], time: 0, distance: 0, transfers: [], lines: [] }];
    const visited = new Set();
    let fastestPath = null;
    let shortestTime = Infinity;

    while (queue.length > 0) {
        const { path, time, distance, transfers, lines } = queue.shift();
        const currentStation = path[path.length - 1];

        if (currentStation === endName) {
            if (time < shortestTime) {
                shortestTime = time;
                // 确保终点站的线路信息被正确更新
                const endLine = lines.length > 0 ? lines[lines.length - 1] : null;
                fastestPath = { path, time, distance, transfers, lines: [...lines, endLine] };
            }
        }

        if (!visited.has(currentStation)) {
            visited.add(currentStation);
            const neighbors = graph[currentStation];

            for (let neighbor in neighbors) {
                if (!path.includes(neighbor)) {
                    const edge = neighbors[neighbor];
                    const newTime = time + edge.length / 80000;
                    const newDistance = distance + edge.length;
                    const lastLine = path.length > 1 ? lineInfo[[path[path.length - 2], currentStation]] : null;
                    const newTransfers = lastLine !== edge.line ? [...transfers, edge.line] : [...transfers];
                    const newLines = [...lines, edge.line];

                    queue.push({ path: [...path, neighbor], time: newTime, distance: newDistance, transfers: newTransfers, lines: newLines });
                }
            }
        }
    }

    return fastestPath;
}

function calculatePrice(distance) {
    if (distance === null || distance === undefined || distance < 0) {
        return null;
    } else if (distance <= 6000) {
        return 3;
    } else if (distance <= 12000) {
        return 4;
    } else if (distance <= 22000) {
        return 5;
    } else if (distance <= 32000) {
        return 6;
    } else if (distance <= 52000) {
        return 7;
    } else if (distance <= 72000) {
        return 8;
    } else if (distance <= 92000) {
        return 9;
    } else {
        return 10; // 可以根据需要设置一个最大的票价
    }
}

// 计算最少换乘路径的函数
function findLeastTransfersPath(graph, startName, endName, lineInfo) {
    const largeTransferPenalty = 166.6; // 大换乘代价（10分钟转换为小时）
    const smallTransferPenalty =  0.35// 小换乘代价（5分钟转换为小时）
    const queue = [{ path: [startName], time: 0, distance: 0, transfers: 0, lines: [] }];
    const visited = new Set();
    let leastTransfersPath = null;
    let fewestTransfers = Infinity;

    while (queue.length > 0) {
        const { path, time, distance, transfers, lines } = queue.shift();
        const currentStation = path[path.length - 1];

        if (currentStation === endName && transfers < fewestTransfers) {
            fewestTransfers = transfers;
            const endLine = lineInfo[[path[path.length - 1], endName]] || (lines.length > 0 ? lines[lines.length - 1] : null);
            leastTransfersPath = { path, time, distance, transfers, lines: [...lines, endLine] };
        }

        if (!visited.has(currentStation)) {
            visited.add(currentStation);
            const neighbors = graph[currentStation];

            for (let neighbor in neighbors) {
                if (!path.includes(neighbor)) {
                    const edge = neighbors[neighbor];
                    const newDistance = distance + edge.length;
                    const lastLine = lines.length > 0 ? lines[lines.length - 1] : null;
                    const newTransfers = lastLine !== edge.line ? transfers + 1 : transfers;
                    const transferTime = lastLine !== edge.line ? largeTransferPenalty : 0;
                    const newTime = time + (edge.length / 80000) + transferTime;

                    queue.push({ path: [...path, neighbor], time: newTime, distance: newDistance, transfers: newTransfers, lines: [...lines, edge.line] });
                    

                }
            }
        }
    }

    // 重新计算实际时间（以分钟为单位）
    let actualTime = 0;
    leastTransfersPath.lines.reduce((prevLine, currentLine, index) => {
        if (index > 0) {
            actualTime += (leastTransfersPath.path[index - 1].length / 80000) ;
            actualTime += prevLine !== currentLine ? smallTransferPenalty  : 0;
        }
        return currentLine;
    }, leastTransfersPath.lines[0]);

    return { ...leastTransfersPath, time: actualTime }; 
}


// 修改版的寻找路径函数
async function findPath(pathData, startStation, endStation, searchType) {
    const { graph, nameToId, lineInfo } = buildGraph(pathData);

    let result;
    if (searchType === '1') {
        result = dijkstraModified(graph, startStation, endStation);
    } else if (searchType === '2') {
        result = findFastestPath(graph, startStation, endStation, lineInfo);
    } else if (searchType === '3') {
        result = findLeastTransfersPath(graph, startStation, endStation, lineInfo);
    }
    return result;
}

export default function Home() {
    // 使用 useState 钩子来存储起始站和终点站的选项
    const [startStationOptions, setStartStationOptions] = React.useState([]);
    const [endStationOptions, setEndStationOptions] = React.useState([]);
    const [startStation, setStartStation] = React.useState('');
    const [endStation, setEndStation] = React.useState('');
    const [findType, setFindType] = React.useState('最短路径');
    const [result, setResult] = React.useState({ path: [], time: 0, distance: 0, transfers: 0, lines: [] });

    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    const attractionToStationMap = TouristAttraction.reduce((map, item) => {
        map[item.attraction] = item.station;
        return map;
    }, {});

    const theme = React.useMemo(
        () =>
            createTheme({
                palette: {
                    mode: prefersDarkMode ? 'dark' : 'light',
                },
            }),
        [prefersDarkMode]
    );

       function handleStationChange(setStation, value) {
        // 检查输入值是否是景点名称，如果是，则映射到对应的地铁站
        const station = attractionToStationMap[value] || value;
        setStation(station);
    }
    function handleClick() {
        // 将文本选项映射为相应的查询类型
        const searchType = findType === '最短路径' ? '1' : findType === '最短时间' ? '2' : '3';

        findPath(pathData, startStation, endStation, searchType).then(value => {
            console.log(value);
            let calculatedPrice = null;
            if (value && value.distance !== undefined && value.distance >= 0) {
                calculatedPrice = calculatePrice(value.distance);
                drawPointsAndLines(value);
            }

            setResult({
                ...value,
                price: calculatedPrice,
            });
        });
    }

    function drawPointsAndLines(value) {
        var ctxElement = document.querySelector('#thecanvas');
        var ctx = ctxElement.getContext('2d');
        ctx.reset();

        var lastx = -1;
        var lasty = -1;
        ctx.lineWidth = 50;
        ctx.strokeStyle = '#ff0000';
        value.path.forEach((item, index) => {
            ctx.beginPath();
            if (lastx != -1) {
                ctx.moveTo(lastx, lasty);
            } else {
                ctx.moveTo(stationPos[nameToId[item]].x, stationPos[nameToId[item]].y);
            }
            ctx.lineTo(stationPos[nameToId[item]].x, stationPos[nameToId[item]].y);
            ctx.stroke();
            ctx.fillRect(stationPos[nameToId[item]].x - 50, stationPos[nameToId[item]].y - 50, 100, 100);
            lastx = stationPos[nameToId[item]].x;
            lasty = stationPos[nameToId[item]].y;
        });
    }

    React.useEffect(() => {
        const startOptions = Array.from(new Set(pathData.map(item => item.name1)));
        const endOptions = Array.from(new Set(pathData.map(item => item.name2)));
        const tourOptions = Array.from(new Set(TouristAttraction.map(item => item.attraction)));
        const inputOptions = [...startOptions, ...endOptions, ...tourOptions]
        setStartStationOptions(inputOptions);
        setEndStationOptions(inputOptions);
    }, []); // 空数组表示这个 effect 只在组件挂载时运行

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Head>
                <title>subwaymap</title>
                <meta name="description" content="Generated by create next app" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <Grid container className={`${styles.main}`}>
                <Grid xs={3} className={styles.leftpane}>
                    <Autocomplete
                        disablePortal
                        value={startStation}
                        onChange={(event, value) => {
                            setStartStation(value);
                        }}
                        options={startStationOptions}
                        onChange={(event, value) => handleStationChange(setStartStation, value)}
                        renderInput={(params) => <TextField {...params} label="起始站" />}
                    />

                    <Autocomplete
                        disablePortal
                        value={endStation}
                        onChange={(event, value) => {
                            setEndStation(value);
                        }}
                        options={endStationOptions}
                        onChange={(event, value) => handleStationChange(setEndStation, value)}
                        renderInput={(params) => <TextField {...params} label="终点站" />}
                    />

                    <Autocomplete
                        disablePortal
                        value={findType}
                        options={['最短路径', '最短时间', '最少换乘']}
                        onChange={(event, value) => {
                            setFindType(value);
                        }}
                        renderInput={params => <TextField {...params} label="线路选择方式" />}
                    />

                    <Button onClick={handleClick}>查找</Button>
                    <Typography>{`价格: ${result.price !== undefined && result.price !== null ? result.price + '元' : '无法计算价格'}`}</Typography>
                    <Typography>{`距离: ${result.distance !== undefined && result.distance !== null ? result.distance / 1000 + '千米' : '无法计算距离'}`}</Typography>
                    <Typography>{`时间: ${result.time !== undefined && result.time !== null ? (result.time * 60).toFixed(6) + '分钟' : '无法计算时间'}`}</Typography>
                    <List dense>
                        {result.path.map((item, index) => (
                            <ListItem key={index}>
                                {/* 显示每个站点及其线路 */}
                                <ListItemText primary={`[${result.lines[index] || '无线路信息'}] ${item}`} />
                            </ListItem>
                        ))}
                    </List>
                </Grid>
                <Grid xs={9} className={styles.rightpane}>
                    <canvas width={14173} height={11942} id="thecanvas" className={styles.theimg}></canvas>
                </Grid>
            </Grid>
        </ThemeProvider>
    );
}
