import pkg from '@metaplex-foundation/mpl-token-metadata';

console.log("Available exports in mpl-token-metadata:");
console.log(Object.keys(pkg));

// Log the structure of nested objects
for (const key of Object.keys(pkg)) {
  if (typeof pkg[key] === 'object' && pkg[key] !== null) {
    console.log(`\nContents of ${key}:`);
    console.log(Object.keys(pkg[key]));
  }
} 