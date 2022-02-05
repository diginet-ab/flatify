#!/usr/bin/env node

import fs from 'fs'
import fsp from "fs/promises"
import { program } from 'commander'
import 'ts-replace-all'
import readJson from 'read-package-json'

type Options = {
    base: string
    extension: string
    json: string
    debug: boolean
    test: boolean
}

const getAllFiles = async (sourceDirPath: string, destDirPath: string = '', aArrayOfFiles: string[] = []) => {
    const files = await fsp.readdir(sourceDirPath)
    let arrayOfFiles = aArrayOfFiles || []
    for (const file of files) {
        if ((await fsp.stat(sourceDirPath + "/" + file)).isDirectory()) {
            arrayOfFiles = await getAllFiles(sourceDirPath + "/" + file, (destDirPath ? destDirPath + "/" : '') + file, arrayOfFiles)
        } else {
            arrayOfFiles.push((destDirPath ? destDirPath + "/" : '') + file)
        }
    }
    return arrayOfFiles
}

export const copyWebBuildFilesToFlatFolder = async (sourcePath: string, destPath: string, options: Options) => {
    await fsp.mkdir(destPath, { recursive: true })
    const files = await getAllFiles(sourcePath, '')
    const fileMap: { publicName: string, localName: string }[] = []
    for (const [index, publicName] of files.entries()) {
        const localName = `${options.base}${index.toString()}${options.extension}`
        const destName = `${destPath}\\${localName}`
        if (options.debug || options.test) {
            if (!options.test)
                console.log(`Copying ${publicName} to ${destName}`)
            else
                console.log(`Would copy ${publicName} to ${destName}`)
        }
        if (!options.test)
            await fsp.copyFile(sourcePath + '/' + publicName, destName)
        fileMap.push({ publicName, localName })
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

const getVersion = async (): Promise<string> => {
    let packageJsonName = ""
    if (fs.existsSync('./package.json'))
        packageJsonName = './package.json'
    else
        packageJsonName = '../package.json'
    const p = new Promise<string>((resolve, reject) => {
        readJson(packageJsonName, undefined, false, (er: any, data: any) => {
            if (!er)
                resolve(data.version as string)
            else
                reject(er)
        })
    })
    return p
}

const main = async () => {
    const defaultSource = './'
    const defaultTarget = './output'

    let version = "?"
    try {
        version = await getVersion()
    } catch {
    }
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
        .version(version)

    program.parse()

}

main()
