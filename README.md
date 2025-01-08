# VietQR Generator

A Node.js command-line tool that generates QR codes with VietQR logo from CSV data and inserts them into SVG templates.

## Installation

Install globally:
```bash
npm install -g vietqr-generator
```

Install locally:
```bash
npm install
```

## Usage

```bash
node index.js -c <csv-file> -t <template-file> -o <output-directory> --logo <logo-file>
```

### Parameters

- `-c, --csv`: Path to the CSV file containing the data
- `-t, --template`: Path to the SVG template file
- `-o, --output`: Directory where generated SVG files will be saved
- `--logo`: Path to the logo file to be inserted into the QR code

### CSV Format

The CSV file should contain these columns:
- `url` or `GenQR`: The content to encode in the QR code
- `STK`: Account number (used for naming the output files)

Example CSV:
```csv
STK,GenQR
1,https://example.com/1
2,https://example.com/2
```

### SVG Template

The SVG template should include a group element with `id="qrcode"` where the QR code will be inserted:

```xml
<g id="qrcode" transform="translate(50,50)">
    <!-- QR code will be inserted here -->
</g>
```

## Example

```bash
node index.js -c ./data.csv -t ./template.svg -o ./output --logo ./logo.png
```

This will:
1. Read each row from data.csv
2. Generate a QR code for each URL/data
3. Insert the QR code into the template
4. Save the resulting SVG files in the output directory

## Dependencies

- qr-code-styling: QR code generation
- csv-parse: CSV file processing
- commander: Command-line interface
- fs-extra: File system operations
