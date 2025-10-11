
const fs = require('fs');
const path = require('path');

// Path to the template and output files
const templatePath = path.join(__dirname, '..', 'farcaster.template.json');
const outputPath = path.join(__dirname, '..', 'public', '.well-known', 'farcaster.json');
const outputDir = path.dirname(outputPath);

// Get the comma-separated addresses from the environment variable
const allowedAddressesStr = process.env.VITE_ALLOWED_ADDRESSES;

if (!allowedAddressesStr) {
  console.error('Error: VITE_ALLOWED_ADDRESSES environment variable is not set.');
  process.exit(1);
}

// Split the string into an array of addresses
const allowedAddresses = allowedAddressesStr.split(',').map(addr => addr.trim());

// Read the template file
fs.readFile(templatePath, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading template file: ${err}`);
    process.exit(1);
  }

  // Replace the placeholder with the JSON stringified array of addresses
  // This correctly formats the array with quotes and commas
  const result = data.replace(
    '"__VITE_ALLOWED_ADDRESSES__"', 
    JSON.stringify(allowedAddresses)
  );

  // Ensure the output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write the final JSON file
  fs.writeFile(outputPath, result, 'utf8', (err) => {
    if (err) {
      console.error(`Error writing final farcaster.json: ${err}`);
      process.exit(1);
    }
    console.log('Successfully generated public/.well-known/farcaster.json');
  });
});
