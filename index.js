import { program } from 'commander';
import { parse } from 'csv-parse';
import fs from 'fs-extra';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import xmljs from 'xml-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

program
  .requiredOption('-c, --csv <path>', 'Path to CSV file')
  .requiredOption('-t, --template <path>', 'Path to SVG template')
  .requiredOption('-o, --output <path>', 'Output directory')
  .parse(process.argv);

const options = program.opts();

function findElementById(elements, id) {
  if (!elements) return null;
  
  for (let element of elements) {
    if (element.type === 'element') {
      if (element.attributes && element.attributes.id === id) {
        return element;
      }
      if (element.elements) {
        const found = findElementById(element.elements, id);
        if (found) return found;
      }
    }
  }
  return null;
}

function getQRPlaceholderSize(templateContent) {
  const templateJson = xmljs.xml2js(templateContent, { compact: false });
  console.log('Template root elements:', templateJson.elements.length);

  const qrGroup = findElementById(templateJson.elements, 'qrcode');
  console.log('Found QR group:', qrGroup?.attributes?.id);
  
  if (!qrGroup) {
    console.log('Available groups:', JSON.stringify(templateJson.elements.map(el => el.attributes?.id).filter(Boolean)));
    throw new Error('Template must contain a group with id="qrcode"');
  }

  const rect = findElementById(qrGroup.elements, 'rect');
  if (rect && rect.attributes) {
    return {
      width: parseFloat(rect.attributes.width) || 1299,
      height: parseFloat(rect.attributes.height) || 1299,
      x: parseFloat(rect.attributes.x) || 642.5,
      y: parseFloat(rect.attributes.y) || 1091.5
    };
  }

  return {
    width: 1299,
    height: 1299,
    x: 642.5,
    y: 1091.5
  };
}

async function generateQR(data) {
  const svgString = await QRCode.toString(data, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });
  
  return svgString;
}

function findQRGroup(element) {
  // Check if current element is the qrcode group
  if (element.type === 'element' && element.name === 'g' && element.attributes?.id === 'qrcode') {
    return element;
  }

  // If element has children, search them
  if (element.elements && Array.isArray(element.elements)) {
    for (const child of element.elements) {
      const found = findQRGroup(child);
      if (found) return found;
    }
  }
  
  return null;
}

function mergeSVGs(templateContent, qrSvgString) {
  const templateJson = xmljs.xml2js(templateContent, { compact: false });
  const qrCodeJson = xmljs.xml2js(qrSvgString, { compact: false });

  const targetGroup = findQRGroup(templateJson.elements[0]);
  
  if (!targetGroup) {
    console.log('Template structure:', JSON.stringify(templateJson, null, 2));
    throw new Error('Template must contain a group with id="qrcode"');
  }

  // Get original QR SVG element with all its attributes
  const qrCodeSvgElement = qrCodeJson.elements[0];
  const originalViewBox = qrCodeSvgElement.attributes.viewBox;
  
  // Calculate dimensions
  const rect = targetGroup.elements?.find(el => el.name === 'rect');
  const width = rect?.attributes?.width || 1299;
  const height = rect?.attributes?.height || 1299;
  const x = rect?.attributes?.x || 642.5;
  const y = rect?.attributes?.y || 1091.5;

  // Create new SVG element preserving QR code content exactly as generated
  const qrSvgElement = {
    type: 'element',
    name: 'svg',
    attributes: {
      x: x,
      y: y,
      width: width,
      height: height,
      viewBox: originalViewBox,
      preserveAspectRatio: 'xMidYMid meet'
    },
    elements: qrCodeSvgElement.elements
  };

  // Replace or add QR code
  if (targetGroup.elements?.length > 0) {
    // Keep rect if it exists
    const nonRectElements = targetGroup.elements.filter(el => el.name !== 'rect');
    if (rect) {
      targetGroup.elements = [rect, qrSvgElement];
    } else {
      targetGroup.elements = [qrSvgElement];
    }
  } else {
    targetGroup.elements = [qrSvgElement];
  }

  return xmljs.js2xml(templateJson, { compact: false, spaces: 2 });
}

async function processCSV() {
  const template = await fs.readFile(options.template, 'utf-8');
  await fs.ensureDir(options.output);

  const qrSize = getQRPlaceholderSize(template);
  console.log('Template QR placeholder size:', qrSize);

  fs.createReadStream(options.csv)
    .pipe(parse({ columns: true }))
    .on('data', async (row) => {
      try {
        const qrData = row.url || row.GenQR;
        const stk = row.STK; // Get STK from CSV
        console.log('Processing QR data for STK:', stk);
        
        const qrSvg = await generateQR(qrData);
        console.log('Generated QR SVG length:', qrSvg.length);
        
        if (!qrSvg) {
          throw new Error('QR generation failed - no SVG data returned');
        }
        
        const outputSvg = mergeSVGs(template, qrSvg);
        // Use STK for filename
        const outputPath = join(options.output, `${stk}.svg`);
        await fs.writeFile(outputPath, outputSvg);
        console.log(`Generated: ${outputPath}`);
      } catch (error) {
        console.error(`Error processing row:`, row, error);
      }
    })
    .on('end', () => {
      console.log('Processing complete');
    });
}

processCSV().catch(console.error);
