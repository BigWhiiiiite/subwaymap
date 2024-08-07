import Head from 'next/head';
import Image from 'next/image';
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

// 构建图的函数
function buildGraph(pathData) {
    const graph = {};
    const nameToId = {};
    const lineInfo = {};

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
    const times = {}; // 新增时间记录
    const paths = {};
    const pathLines = {};
    const nodes = new Set(Object.keys(graph));

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
    pathLines[startName] = [];

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
            const newDistance = distances[closestNode] + neighbors[neighbor].length;
            const newTime = times[closestNode] + neighbors[neighbor].length / 80000; // 新的时间计算

            if (newDistance < distances[neighbor]) {
                distances[neighbor] = newDistance;
                times[neighbor] = newTime; // 更新时间
                paths[neighbor] = [...paths[closestNode], neighbor];
                pathLines[neighbor] = [...pathLines[closestNode], neighbors[neighbor].line];
            }
        }
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
                fastestPath = { path, time, distance, transfers, lines };
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

// 使用示例
// console.log(findShortestPath(pathData, '北宫门', '北工大西门', '2'));
async function findShortestPath(pathData, startStation, endStation, searchType) {
    const { graph, nameToId, lineInfo } = buildGraph(pathData);

    let result;
    if (searchType === '1') {
        result = dijkstraModified(graph, startStation, endStation);
    } else if (searchType === '2') {
        result = findFastestPath(graph, startStation, endStation, lineInfo);
    }
    return result;
}

export default function Home() {
    // 使用 useState 钩子来存储起始站和终点站的选项
    const [startStationOptions, setStartStationOptions] = React.useState([]);
    const [endStationOptions, setEndStationOptions] = React.useState([]);

    const [startStation, setStartStation] = React.useState('');
    const [endStation, setEndStation] = React.useState('');
    const [findType, setFindType] = React.useState('1');
    const [result, setResult] = React.useState({ path: [], time: 0, distance: 0, transfers: 0, lines: [] });

    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

    const theme = React.useMemo(
        () =>
            createTheme({
                palette: {
                    mode: prefersDarkMode ? 'dark' : 'light',
                },
            }),
        [prefersDarkMode]
    );

    function handleClick() {
        findShortestPath(pathData, startStation, endStation, findType).then(value => {
            console.log(value);

            let calculatedPrice = null;
            if (value && value.distance !== undefined && value.distance >= 0) {
                calculatedPrice = calculatePrice(value.distance);
            }

            setResult({
                ...value,
                price: calculatedPrice,
            });
        });
    }

    React.useEffect(() => {
        const startOptions = Array.from(new Set(pathData.map(item => item.name1)));
        const endOptions = Array.from(new Set(pathData.map(item => item.name2)));
        setStartStationOptions(startOptions);
        setEndStationOptions(endOptions);
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
                        renderInput={params => <TextField {...params} label="起始站" />}
                    />
                    <Autocomplete
                        disablePortal
                        value={endStation}
                        onChange={(event, value) => {
                            setEndStation(value);
                        }}
                        options={endStationOptions}
                        renderInput={params => <TextField {...params} label="终点站" />}
                    />
                    <Autocomplete
                        disablePortal
                        value={findType}
                        options={['1', '2']}
                        onChange={(event, value) => {
                            setFindType(value);
                        }}
                        renderInput={params => <TextField {...params} label="线路选择方式" />}
                    />
                    <Button onClick={handleClick}>查找</Button>
                    <Typography>{`价格: ${result.price !== undefined && result.price !== null ? result.price + '元' : '无法计算价格'}`}</Typography>
                    <Typography>{`距离: ${result.distance !== undefined && result.distance !== null ? result.distance / 1000 + '千米' : '无法计算距离'}`}</Typography>
                    <Typography>{`时间: ${result.time !== undefined && result.time !== null ? (result.time * 60).toFixed(2) + '分钟' : '无法计算时间'}`}</Typography>
                    <List dense>
                        {result.path.map((item, index) => {
                            return (
                                <ListItem key={index}>
                                    <ListItemText primary={`[${index == 0 ? '起点' : result.lines[index - 1]}] ${item}`} />
                                </ListItem>
                            );
                        })}
                    </List>
                </Grid>
                <Grid xs={9} className={styles.rightpane}>
                    <img src="/map.png" className={styles.theimg}></img>
                </Grid>
            </Grid>
        </ThemeProvider>
    );
}
