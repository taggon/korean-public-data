const path = require('path');
const fs = require('fs');
const util = require('util');
const execFile = util.promisify( require('child_process').execFile );
const glob = require('fast-glob');
const Ajv = require('ajv');
const debug = require('debug')('build');
const schema = require('../data/schema.json');

const rootDir = path.resolve(__dirname, '..');

function isMetaJson(filepath) {
    if ( path.basename(filepath) !== 'meta.json' ) return false;
    return filepath.split(path.sep)[0] === 'data';
}

function loadJson(jsonPath) {
    const resolvedPath = path.resolve(rootDir, jsonPath);
    const json = require(resolvedPath);
    const entryDir  = path.dirname(resolvedPath);

    for (const file of json.files) {
        file.filename = path.relative(rootDir, path.resolve(entryDir, file.filename));
    }

    return json;
}

async function build() {
    const { stdout } = await execFile('git', ['diff', '--staged', '--name-only']);
    const files = stdout.split('\n').filter(isMetaJson);

    if (!files.length) return;

    const validate = (new Ajv({allErrors: true})).compile(schema);
    const entries = glob.sync(['data/**/meta.json']).map(loadJson).filter(data => validate(data));
    const jsonPath = path.resolve(__dirname, '..', 'data', 'all.json');
    const json = {
        _: '### Do not modify this file directly! ###',
        title: 'Korean public data',
        lastUpdated: new Date('1970-01-01'),
        entries: [],
    };

    for (const entry of entries) {
        const lastUpdated = new Date(Date.parse(entry.lastUpdated));

        json.entries.push(entry);

        if ( json.lastUpdated.getTime() < lastUpdated.getTime() ) {
            json.lastUpdated = lastUpdated;
        }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));

    debug('data.json file has been updated.');

    await execFile('git', ['add', jsonPath]);
}

build();