import prompts from 'prompts';
import chalk from 'chalk';
import { DEFAULT_DECIMALS, DEFAULT_INITIAL_SUPPLY } from './config.js';

/**
 * Interactively get token information from the user
 * @returns {Promise<Object>} The token information
 */
export async function getTokenInfo() {
  const questions = [
    {
      type: 'text',
      name: 'name',
      message: 'Token name:',
      validate: value => value.length > 0 ? true : 'Name is required'
    },
    {
      type: 'text',
      name: 'symbol',
      message: 'Token symbol:',
      validate: value => value.length > 0 ? true : 'Symbol is required'
    },
    {
      type: 'number',
      name: 'decimals',
      message: 'Token decimals:',
      initial: DEFAULT_DECIMALS,
      validate: value => (value >= 0 && value <= 9) ? true : 'Decimals must be between 0 and 9'
    },
    {
      type: 'text',
      name: 'initialSupply',
      message: 'Initial supply:',
      initial: DEFAULT_INITIAL_SUPPLY.toString(),
      validate: value => {
        const num = Number(value);
        return !isNaN(num) && num > 0 ? true : 'Initial supply must be a positive number';
      }
    },
    {
      type: 'text',
      name: 'description',
      message: 'Token description (optional):',
    },
    {
      type: 'text',
      name: 'imageUrl',
      message: 'Token image URL (optional):'
    }
  ];

  let response;
  
  try {
    response = await prompts(questions, {
      onCancel: () => {
        console.log(chalk.yellow('\nToken creation cancelled.'));
        return { name: '' };
      }
    });
    
    // Convert initialSupply to a number
    if (response.initialSupply) {
      response.initialSupply = Number(response.initialSupply);
    }
    
    return response;
  } catch (error) {
    console.error(chalk.red(`\n❌ Error gathering token information: ${error.message}`));
    return { name: '' };
  }
} 