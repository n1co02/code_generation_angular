#!/usr/bin/env node
import inquirer from 'inquirer'
import fs from 'fs'
import chalk from 'chalk'
import chalkRainbow from 'chalk-rainbow'
import { createSpinner } from 'nanospinner'
import figlet from 'figlet'
import { getFilePath } from './src/codeGenerator'

const run = async () => {
  console.log(chalk.blue('Welcome to the best Angular Codegeneration Tool!'))

  const { filePath, usePrettier } = await inquirer.prompt([
    {
      type: 'input',
      name: 'filePath',
      message: 'Please provide your file path:',
      validate: (input) =>
        fs.existsSync(input) ||
        'File does not exist at the specified path. Please enter a valid path.',
    },
    {
      type: 'confirm',
      name: 'usePrettier',
      message: 'Do you want to use Prettier for the files?',
      default: false,
    },
  ])

  const spinner = createSpinner('Processing...\n').spin()

  try {
    await getFilePath(filePath, usePrettier)
    const data = figlet.textSync('Success!')
    spinner.success({ text: chalkRainbow(data) })
    console.log(
      chalk.blue(
        "Your Angular files have been stored in services Directory! Let's go!",
      ),
    )
  } catch (err) {
    spinner.error({ text: `Error: ${err.message}` })
    console.error(chalk.red(`Error: ${err.message}`))
  }
}

run().catch((err) => console.error(chalk.red(`Error: ${err.message}`)))
