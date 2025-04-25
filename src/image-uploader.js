import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import chalk from 'chalk';
import { IMGBB_API_KEY, NFT_STORAGE_API_KEY, IMAGE_OUTPUT_DIR } from './config.js';
import mime from 'mime-types';

/**
 * Upload an image to a storage provider
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<Object>} Result of upload operation
 */
export async function uploadImage(imagePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`File not found: ${imagePath}`);
    }
    
    // Get file extension and MIME type
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = mime.lookup(ext) || 'application/octet-stream';
    
    // Check if it's an image
    if (!mimeType.startsWith('image/')) {
      throw new Error(`File is not a recognized image format: ${imagePath}`);
    }
    
    // Read file
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Check file size (max 10MB)
    const fileSizeMB = imageBuffer.length / (1024 * 1024);
    if (fileSizeMB > 10) {
      throw new Error(`Image file is too large (${fileSizeMB.toFixed(2)}MB). Maximum allowed size is 10MB.`);
    }
    
    console.log(chalk.blue(`📝 File information:`));
    console.log(chalk.white(`   Type: ${mimeType}`));
    console.log(chalk.white(`   Size: ${fileSizeMB.toFixed(2)}MB`));
    
    // Try primary image hosting service (ImgBB)
    let imgbbResult = null;
    if (IMGBB_API_KEY) {
      try {
        console.log(chalk.blue(`🔄 Uploading to ImgBB...`));
        imgbbResult = await uploadToImgBB(imagePath, imageBuffer);
        console.log(chalk.green(`✅ Successfully uploaded to ImgBB!`));
      } catch (error) {
        console.error(chalk.yellow(`⚠️ Failed to upload to ImgBB: ${error.message}`));
      }
    } else {
      console.log(chalk.yellow(`⚠️ ImgBB API key not provided. Skipping ImgBB upload.`));
    }
    
    // Try NFT.Storage
    let nftStorageResult = null;
    if (NFT_STORAGE_API_KEY) {
      try {
        console.log(chalk.blue(`🔄 Uploading to NFT.Storage...`));
        nftStorageResult = await uploadToNFTStorage(imagePath, imageBuffer, mimeType);
        console.log(chalk.green(`✅ Successfully uploaded to NFT.Storage!`));
      } catch (error) {
        console.error(chalk.yellow(`⚠️ Failed to upload to NFT.Storage: ${error.message}`));
      }
    } else {
      console.log(chalk.yellow(`⚠️ NFT.Storage API key not provided. Skipping NFT.Storage upload.`));
    }
    
    // Determine the result URL (prioritize IPFS for metadata purposes)
    const resultUrl = (nftStorageResult && nftStorageResult.url) || 
                     (imgbbResult && imgbbResult.url) || 
                     null;
    
    if (!resultUrl) {
      throw new Error('Failed to upload image to any service.');
    }
    
    return {
      success: true,
      url: resultUrl,
      imgbb: imgbbResult,
      nftStorage: nftStorageResult
    };
  } catch (error) {
    console.error(chalk.red(`\n❌ Error uploading image: ${error.message}`));
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload an image to ImgBB
 * @param {string} imagePath - Path to the image file
 * @param {Buffer} imageBuffer - Image data buffer
 * @returns {Promise<Object>} Result of ImgBB upload
 */
async function uploadToImgBB(imagePath, imageBuffer) {
  try {
    const formData = new FormData();
    formData.append('image', imageBuffer);
    
    const response = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
    
    if (response.data && response.data.data) {
      return {
        success: true,
        url: response.data.data.url,
        displayUrl: response.data.data.display_url,
        deleteUrl: response.data.data.delete_url
      };
    } else {
      throw new Error('Invalid response from ImgBB API');
    }
  } catch (error) {
    console.error(chalk.dim(`ImgBB error: ${error.message}`));
    throw error;
  }
}

/**
 * Upload an image to NFT.Storage
 * @param {string} imagePath - Path to the image file
 * @param {Buffer} imageBuffer - Image data buffer
 * @param {string} mimeType - MIME type of the image
 * @returns {Promise<Object>} Result of NFT.Storage upload
 */
async function uploadToNFTStorage(imagePath, imageBuffer, mimeType) {
  try {
    const filename = path.basename(imagePath);
    
    const response = await axios.post('https://api.nft.storage/upload', imageBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Authorization': `Bearer ${NFT_STORAGE_API_KEY}`
      }
    });
    
    if (response.data && response.data.ok && response.data.value && response.data.value.cid) {
      const cid = response.data.value.cid;
      return {
        success: true,
        cid: cid,
        ipfs: `ipfs://${cid}`,
        url: `https://ipfs.io/ipfs/${cid}`
      };
    } else {
      throw new Error('Invalid response from NFT.Storage API');
    }
  } catch (error) {
    console.error(chalk.dim(`NFT.Storage error: ${error.message}`));
    throw error;
  }
} 