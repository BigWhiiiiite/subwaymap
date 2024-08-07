const fs = require('fs');
const parse = require('csv-parse');

function csvToJson(filePath, callback) {
    const results = [];

    fs.createReadStream(filePath)
        .pipe(
            parse.parse({
                columns: true,
                trim: true,
            })
        )
        .on('data', data => results.push(data))
        .on('end', () => {
            callback(results);
        });
}

// Usage
csvToJson('./update data.csv', json => {
    // console.log(json);
    fs.writeFileSync('./pathdata.json', JSON.stringify(json), { encoding: 'utf-8' });
});
