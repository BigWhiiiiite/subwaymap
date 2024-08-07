import csv
from collections import deque

def read_graph_from_csv_modified(file_path):
    graph = {}
    name_to_id = {}
    id_to_name = {}
    line_info = {}

    with open(file_path, 'r', encoding="utf-8") as file:
        reader = csv.reader(file)
        for row in reader:
            id1, id2, name1, name2, length, line_name = row
            id1, id2, length = int(id1), int(id2), int(length)

            if id1 not in name_to_id:
                name_to_id[name1] = id1
                id_to_name[id1] = name1
            if id2 not in name_to_id:
                name_to_id[name2] = id2
                id_to_name[id2] = name2

            if name1 not in graph:
                graph[name1] = {}
            if name2 not in graph:
                graph[name2] = {}

            graph[name1][name2] = (length, line_name)
            graph[name2][name1] = (length, line_name)

            # 存储线路信息
            line_info[(name1, name2)] = line_name
            line_info[(name2, name1)] = line_name
    
    return graph, name_to_id, id_to_name, line_info

def dijkstra_modified(graph, start_name, end_name, name_to_id):
    start = name_to_id.get(start_name)
    end = name_to_id.get(end_name)

    if start is None or end is None:
        return None, None, None

    distances = {node: float('inf') for node in graph}
    paths = {node: [] for node in graph}
    path_lines = {node: [] for node in graph}
    distances[start_name] = 0
    paths[start_name] = [start_name]
    path_lines[start_name] = []
    
    unvisited = list(graph.keys())
    
    while unvisited:
        current_node = min(unvisited, key=lambda node: distances[node] if node in distances else float('inf'))
        unvisited.remove(current_node)

        for neighbour, (edge_cost, line) in graph[current_node].items():
            new_distance = distances[current_node] + edge_cost
            if new_distance < distances.get(neighbour, float('inf')):
                distances[neighbour] = new_distance
                paths[neighbour] = paths[current_node] + [neighbour]
                path_lines[neighbour] = path_lines[current_node] + [line] if path_lines[current_node][-1:] != [line] else path_lines[current_node]

    return distances[end_name], paths[end_name], path_lines[end_name]

def find_fastest_path(graph, start_name, end_name, name_to_id, line_info):
    if start_name not in graph or end_name not in graph:
        return None, None, None, []

    queue = deque([([start_name], 0, 0, [])])  # (当前路径, 累积时间, 累积距离, 换乘线路)
    visited = set()
    fastest_path = []
    shortest_time = float('inf')
    total_distance = 0
    transfers = []

    while queue:
        path, current_time, current_distance, current_transfers = queue.popleft()
        current_station = path[-1]

        if current_station == end_name:
            # 计算包括换乘时间的总用时
            total_transfer_time = 0.05 * (len(current_transfers) - 1)
            total_time = current_time + total_transfer_time
            if total_time < shortest_time:
                shortest_time = total_time
                fastest_path = path
                total_distance = current_distance
                transfers = current_transfers

        if current_station not in visited:
            visited.add(current_station)
            last_line = line_info.get((path[-2], current_station)) if len(path) > 1 else None
            for neighbour, (edge_cost, line) in graph[current_station].items():
                if neighbour not in path:  # 防止循环
                    new_time = current_time + edge_cost / 80000
                    new_distance = current_distance + edge_cost
                    new_transfers = current_transfers.copy()
                    if line != last_line:
                        new_transfers.append(line)
                    queue.append((path + [neighbour], new_time, new_distance, new_transfers))

    return fastest_path, shortest_time, total_distance, transfers


def find_shortest_path(file_path):
    graph, name_to_id, id_to_name, line_info = read_graph_from_csv_modified(file_path)

    start_station = input("请输入起始站的名称: ")
    end_station = input("请输入终点站的名称: ")
    search_type = input("请选择搜索类型（1：最短距离，2：最短用时）: ")

    if search_type == "1":
        cost, path, lines = dijkstra_modified(graph, start_station, end_station, name_to_id)
        if cost is None:
            print("未找到有效路径。")
        else:
            print(f"最短路径应为: {' -> '.join(path)}")
            print(f"最短距离是: {cost}米")

            # 根据距离确定票价
        if 0 <= cost <= 6000:
            print("价格为3元")
        elif 6001 <= cost <= 12000:
            print("价格为4元")
        elif 12001 <= cost <= 22000:
            print("价格为5元")
        elif 22001 <= cost <= 32000:
            print("价格为6元")
        elif 32001 <= cost <= 52000:
            print("价格为7元")
        elif 52001 <= cost <= 72000:
            print("价格为8元")
        elif 72001 <= cost <= 92000:
            print("价格为9元")
        else:
            print("距离超出计价范围，无法确定票价")

        # 输出换乘信息
        transfer_count = len(lines) - 1
        print(f"换乘次数: {transfer_count}")
        if transfer_count > 0:
            print(f"换乘线路: {' -> '.join(lines)}")

    elif search_type == "2":
        fastest_path, shortest_time, total_distance, transfers = find_fastest_path(graph, start_station, end_station, name_to_id, line_info)
        if not fastest_path:
            print("未找到有效路径。")
        else:
            print(f"最快路径为: {' -> '.join(fastest_path)}")
            print(f"预计用时: {shortest_time:.2f}小时")
            print(f"总距离: {total_distance}米")
            print(f"换乘次数: {len(transfers)-1}")
            if transfers:
                print(f"换乘线路: {' -> '.join(transfers)}")

        # 根据距离确定票价
            if 0 <= total_distance <= 6000:
                print("价格为3元")
            elif 6001 <= total_distance <= 12000:
                print("价格为4元")
            elif 12001 <= total_distance <= 22000:
                print("价格为5元")
            elif 22001 <= total_distance <= 32000:
                print("价格为6元")
            elif 32001 <= total_distance <= 52000:
                print("价格为7元")
            elif 52001 <= total_distance <= 72000:
                print("价格为8元")
            elif 72001 <= total_distance <= 92000:
                print("价格为9元")
            else:
                print("距离超出计价范围，无法确定票价")

        
# 使用示例
file_path = "./update data.csv"  # 替换为您的CSV文件路径
find_shortest_path(file_path)
