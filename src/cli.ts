#!/usr/bin/env/node

import { expandCompound, launch, readLaunchJson } from './launch'

async function main(): Promise<void> {
    try {
        const json = await readLaunchJson(process.argv[2] || process.cwd() + '/.vscode/launch.json')
        const compound = process.argv[3]
        const configs = compound ? expandCompound(json, compound) : json.configurations
        await launch(configs)
    } catch (err) {
        console.error(err)
        process.exit(1)
    }
}

main()
