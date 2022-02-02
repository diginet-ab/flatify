#!/usr/bin/env node

import fsp from "fs/promises"
import path from "path"
import { program } from 'commander'

type Options = {
    base: string
    extension: string
    json: string
    debug: boolean
    test: boolean
}

const getAllFiles = async (dirPath: string, aArrayOfFiles: string[]) => {
    const files = await fsp.readdir(dirPath)
    let arrayOfFiles = aArrayOfFiles || []
    for (const file of files) {
        if ((await fsp.stat(dirPath + "/" + file)).isDirectory()) {
            arrayOfFiles = await getAllFiles(dirPath + "/" + file, arrayOfFiles)
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file))
        }
    }
    return arrayOfFiles
}

export const copyWebBuildFilesToFlatFolder = async (sourcePath: string, destPath: string, options: Options) => {
    await fsp.mkdir(destPath, { recursive: true })
    const files = await getAllFiles(sourcePath, [])
    console.log(files)
    for (const [index, file] of files.entries()) {
        const dest = `${destPath}\\${ options.base }${index.toString()}${ options.extension }`
        if (options.debug || options.test) {
            if (!options.test)
                console.log(`Copying ${ file } to ${ dest }`)
            else
                console.log(`Would copy ${ file } to ${ dest }`)
        }
        if (!options.test)
            await fsp.copyFile(file, dest)
    }
    const localFiles = files.map(file => {
        return file.replaceAll('\\', '/')
    })
    await fsp.writeFile(destPath + `\\${ options.json }`, JSON.stringify(localFiles, undefined, 2))
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sprintf = (strings: TemplateStringsArray, ...indices: number[]) => {
    return (...values: string[]) =>
        strings.reduce((total, part, index) =>
            total + part + (values[indices[index]] || ''), ''
        )
}

const defaultSource = './'
const defaultTarget = './output'

program
    .name('flatify')
    .description('CLI to flatten a source folder with hierarchical folder structure to a flat list of numbered files in a target folder. A JSON file is also output containing an array of the original names.')
    .version('0.0.0')
    .option('-b, --base <name>', 'Flat file base name', 'file')
    .option('-e, --extension <ext>', 'Flat file extension', '.bin')
    .option('-j, --json <name>', 'JSON file name', 'files.json')
    .option('-d, --debug', 'Debug info')
    .option('-t, --test', 'Display files but do not copy')
    .argument('[source]', 'source folder', defaultSource)
    .argument('[target]', 'target folder', defaultTarget)
    .action(async (source, target, options: Options, command) => {
        await copyWebBuildFilesToFlatFolder(source, target, options)
    })

program.parse()

