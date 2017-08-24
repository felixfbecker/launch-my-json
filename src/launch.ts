
import * as chalk from 'chalk'
import onExit = require('exit-hook')
import leftPad = require('left-pad')
import { spawn } from 'mz/child_process'
import { readFile } from 'mz/fs'
import stripJsonComments = require('strip-json-comments')

export type LaunchConfiguration = GoLaunchConfiguration

export interface BaseLaunchConfiguration {
    name: string
    type: string
    request: 'launch' | 'attach'
}

export interface GoLaunchConfiguration extends BaseLaunchConfiguration {
    type: 'go',
    request: 'launch',
    program: string
    stopOnEntry?: boolean
    args?: string[]
    showLog?: boolean
    cwd?: string
    env?: { [key: string]: string; }
    mode?: string
    remotePath?: string
    port?: number
    host?: string
    buildFlags?: string
    init?: string
    trace?: boolean | 'verbose'
    /** Optional path to .env file. */
    envFile?: string
    backend?: string
}

export interface CompoundConfiguration {
    name: string
    configurations: string[]
}

export interface LaunchJson {
    version: string
    configurations: LaunchConfiguration[]
    compounds: CompoundConfiguration[]
}

function expandVariables<T>(value: T): T {
    if (typeof value === 'string') {
        return value
            .replace(/\$\{workspaceRoot\}/g, process.cwd())
            .replace(/\$\{env\.(\w+)\}/g, (match, varName) => process.env[varName] || '') as any
    }
    if (typeof value === 'object' && value !== null) {
        for (const key of (Array.isArray(value) ? value.keys() : Object.keys(value))) {
            value[key] = expandVariables(value[key])
        }
    }
    return value
}

export async function readLaunchJson(path: string): Promise<LaunchJson> {
    const content = await readFile(path, 'utf-8')
    const json = stripJsonComments(content)
    return JSON.parse(json)
}

const COLORS = [
    chalk.magenta,
    chalk.blue,
    chalk.cyan,
    chalk.green,
    chalk.yellow,
    chalk.red
]

export function expandCompound(launchJson: LaunchJson, name: string): LaunchConfiguration[] {
    const config = launchJson.configurations.find(c => c.name === name)
    if (config) {
        return [config]
    }
    const compoundConfig = launchJson.compounds.find(c => c.name === name)
    if (compoundConfig) {
        return compoundConfig.configurations.reduce((configs, child) => configs.concat(expandCompound(launchJson, child)), [] as LaunchConfiguration[])
    }
    return []
}

export async function launch(configs: LaunchConfiguration[]): Promise<void> {
    configs = expandVariables(configs)
    const nameWidth = Math.max(...configs.map(config => config.name.length)) + 1
    for (const config of configs) {
        switch (config.type) {
            case 'go': {
                if (config.request !== 'launch') {
                    continue
                }
                const color = COLORS[Math.floor(Math.random() * COLORS.length)]
                const cp = spawn('go', ['run', config.program, ...(config.args || [])], {
                    cwd: config.cwd,
                    env: { ...process.env, ...config.env }
                })
                onExit(() => {
                    cp.kill()
                })
                for (const fd of ['stdout', 'stderr'] as ['stdout', 'stderr']) {
                    cp[fd].on('data', chunk => {
                        const lines = chunk.toString().split('\n').map(line => color(new Date().toLocaleTimeString() + leftPad(config.name, nameWidth, ' ') + ' | ') + line)
                        process[fd].write(lines.join('\n') + '\n')
                    })
                }
            }
        }
    }
}
