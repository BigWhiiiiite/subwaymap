import csv
import json

# CSV 文件路径
csv_file_path = '../TouristAttraction.csv'

# JSON 文件路径
json_file_path = './TouristAttraction.json'

# 读取CSV文件并转换为JSON
data = []
with open(csv_file_path, mode='r', encoding='utf-8') as csv_file:
    csv_reader = csv.DictReader(csv_file)
    for row in csv_reader:
        data.append(row)

# 写入JSON文件
with open(json_file_path, mode='w', encoding='utf-8') as json_file:
    json_file.write(json.dumps(data, indent=4, ensure_ascii=False))
