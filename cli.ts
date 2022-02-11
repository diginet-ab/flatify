#!/usr/bin/env node

import fs from 'fs'
import fsp from "fs/promises"
import { program } from 'commander'
import 'ts-replace-all'
import path from 'path/posix'

type Options = {
    base: string
    extension: string
    json: string
    debug: boolean
    target: string
    no: boolean
}

type FileMap = {
    sourceFilePath: string
    filePath: string
}

const getAllFiles = async (sourceDirPaths: string[], destDirPath: string = '', excludePath: string, aArrayOfFiles: FileMap[] = []) => {
    let arrayOfFiles = aArrayOfFiles || []
    for (const sourceDirPath of sourceDirPaths) {
        let sourcePath = sourceDirPath
        let destPath = destDirPath
        if (sourceDirPath.indexOf(':') >= 0) {
            const parts = sourceDirPath.split(':')
            sourcePath = parts[0]
            destPath += (destPath ? '/' : '') + parts[1]
        }
        if (sourcePath !== excludePath) {
            let files: { source: string, dest: string }[] = []
            const stat = await fsp.stat(sourcePath)
            if (stat.isFile())
                files.push({ source: sourcePath, dest: (destPath ? destPath + "/" : '') + path.basename(sourcePath) })
            else {
                const sources = await fsp.readdir(sourcePath)
                files = sources.map(f => ({ source: sourcePath + "/" + f, dest: (destPath ? destPath + "/" : '') + f } ))
            }
            for (const file of files) {
                if (!(await fsp.stat(file.source)).isFile()) {
                    arrayOfFiles = await getAllFiles([file.source], file.dest, excludePath, arrayOfFiles)
                } else {
                    arrayOfFiles.push({ sourceFilePath: file.source, filePath: file.dest })
                }
            }
        }
    }
    return arrayOfFiles
}

export const copyWebBuildFilesToFlatFolder = async (sourcePaths: string[], destPath: string, options: Options) => {
    if (!options.no)
        await fsp.mkdir(destPath, { recursive: true })
    else
        console.log(`Would create folder ${destPath}`)
    const files = await getAllFiles(sourcePaths, '', destPath)
    const fileMap: { publicName: string, localName: string }[] = []
    for (const [index, map] of files.entries()) {
        const localName = `${options.base}${index.toString()}${options.extension}`
        const destName = `${destPath}/${localName}`
        if (options.debug || options.no) {
            if (!options.no)
                console.log(`Copying ${map.sourceFilePath} to ${destName} as ${map.filePath}`)
            else
                console.log(`Would copy ${map.sourceFilePath} to ${destName} as ${map.filePath}`)
        }
        if (!options.no)
            await fsp.copyFile(map.sourceFilePath, destName)
        fileMap.push({ publicName: map.filePath, localName })
    }
    const modifiedTime = new Date()
    const modifiedTimeString = modifiedTime.toDateString() + ' ' + modifiedTime.toTimeString()
    const jsonFile = destPath + `\\${options.json}`
    const jsonText = JSON.stringify({ fileMap, date: modifiedTimeString }, undefined, 2)
    if (!options.no)
        await fsp.writeFile(jsonFile, jsonText)
    else {
        console.log(`Would write ${ jsonFile }: `, jsonText)
    }
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
        .option('-t, --target <target>', 'Target folder', './output')
        .option('-n, --no', 'Display files but do not copy')
        .argument('[source...]', 'Source folders with optional target folder separated by colon (ex: ./build:www)', defaultSource)
        .action(async (source, options: Options, command) => {
            await copyWebBuildFilesToFlatFolder(source.map((s: string) => s.replaceAll('\\', '/')), options.target.replaceAll('\\', '/'), options)
        })

    program.parse()

}

main()
