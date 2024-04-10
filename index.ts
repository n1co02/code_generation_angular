import * as readline from 'readline'
import * as fs from 'fs'
import { getFilePath } from './src/codeGenerator'

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

// Ask for the file path
rl.question('Please provide your file path: ', (filePath) => {
  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    console.error('File does not exist at the specified path')
    rl.close()
    return
  }

  // Ask for prettier usage
  rl.question(
    'Do you want to use Prettier for the files? (yes/no): ',
    (answer) => {
      const usePrettier = answer.toLowerCase() === 'yes'

      getFilePath(filePath, usePrettier)
      rl.close()
    },
  )
})
