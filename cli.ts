#!/usr/bin/env node

import fs from 'fs'
import fsp from "fs/promises"
import { program } from 'commander'
import 'ts-replace-all'

type Options = {
    base: string
    extension: string
    json: string
    debug: boolean
    target: string
    test: boolean
}

type FileMap = {
    sourceFilePath: string
    filePath: string
}

const getAllFiles = async (sourceDirPaths: string[], destDirPath: string = '', excludePath: string, aArrayOfFiles: FileMap[] = []) => {
    let arrayOfFiles = aArrayOfFiles || []
    for (const sourceDirPath of sourceDirPaths) {
        if (sourceDirPath !== excludePath) {
            const files = await fsp.readdir(sourceDirPath)
            for (const file of files) {
                if ((await fsp.stat(sourceDirPath + "/" + file)).isDirectory()) {
                    arrayOfFiles = await getAllFiles([sourceDirPath + "/" + file], (destDirPath ? destDirPath + "/" : '') + file, excludePath, arrayOfFiles)
                } else {
                    arrayOfFiles.push({ sourceFilePath: sourceDirPath + "/" + file, filePath: (destDirPath ? destDirPath + "/" : '') + file })
                }
            }
        }
    }
    return arrayOfFiles
}

export const copyWebBuildFilesToFlatFolder = async (sourcePaths: string[], destPath: string, options: Options) => {
    await fsp.mkdir(destPath, { recursive: true })
    const files = await getAllFiles(sourcePaths, '', destPath)
    const fileMap: { publicName: string, localName: string }[] = []
    for (const [index, map] of files.entries()) {
        const localName = `${options.base}${index.toString()}${options.extension}`
        const destName = `${destPath}/${localName}`
        if (options.debug || options.test) {
            if (!options.test)
                console.log(`Copying ${map.sourceFilePath} to ${destName}`)
            else
                console.log(`Would copy ${map} to ${destName}`)
        }
        if (!options.test)
            await fsp.copyFile(map.sourceFilePath, destName)
        fileMap.push({ publicName: map.filePath, localName })
    }
    const modifiedTime = new Date()
    const modifiedTimeString = modifiedTime.toDateString() + ' ' + modifiedTime.toTimeString()
    await fsp.writeFile(destPath + `\\${options.json}`, JSON.stringify({ fileMap, date: modifiedTimeString }, undefined, 2))
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sprintf = (strings: TemplateStringsArray, ...indices: number[]) => {
    return (...values: string[]) =>
        strings.reduce((total, part, index) =>
            total + part + (values[indices[index]] || ''), ''
        )
}

const getVersion = async () => {
    let packageJson: { version?: string } = {}
    let json = ''
    try {
        json = fs.readFileSync(__dirname + '/package.json', { encoding: 'utf-8' })
    } catch {
        json = fs.readFileSync(__dirname + '/../package.json', { encoding: 'utf-8' })
    }
    packageJson = JSON.parse(json)
    return packageJson.version
}

const main = async () => {
    const defaultSource = ['.']
    const defaultTarget = './output'

    let version = ''
    try {
        let ver = await getVersion()
        if (ver)
            version = ver
    } catch {
    }
    program
        .name('flatify')
        .description('CLI to flatten a source folder with hierarchical folder structure to a flat list of numbered files in a target folder. A JSON file is also output containing an array of the original names.')
        .version(version)
        .option('-b, --base <name>', 'Flat file base name', 'file')
        .option('-e, --extension <ext>', 'Flat file extension', '.bin')
        .option('-j, --json <name>', 'JSON file name', 'files.json')
        .option('-d, --debug', 'Debug info')
        .option('-t, --target', 'Target folder', './output')
        .option('-T, --test', 'Display files but do not copy')
        .argument('[source...]', 'source folders', defaultSource)
        .action(async (source, options: Options, command) => {
            await copyWebBuildFilesToFlatFolder(source, options.target, options)
        })

    program.parse()

}

main()
