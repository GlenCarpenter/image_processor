import { fal } from "@fal-ai/client";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Configure your API key
fal.config({
    credentials: process.env.FAL_KEY || "YOUR_FAL_KEY"
});

interface UpscaleOptions {
    inputDir: string;
    outputDir: string;
    upscaleMode?: "factor" | "target";
    upscaleFactor?: number;
    targetResolution?: "720p" | "1080p" | "1440p" | "2160p";
    noiseScale?: number;
    outputFormat?: "png" | "jpg" | "webp";
    concurrency?: number;
}

interface UpscaleResult {
    fileName: string;
    success: boolean;
    outputPath?: string;
    error?: string;
}

// Supported image extensions
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

/**
 * Get all image files from a directory
 */
function getImageFiles(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) {
        throw new Error(`Directory not found: ${dirPath}`);
    }

    const files = fs.readdirSync(dirPath);
    return files.filter((file: string) => {
        const ext = path.extname(file).toLowerCase();
        return IMAGE_EXTENSIONS.includes(ext);
    });
}

/**
 * Upload a file to fal storage and return the URL
 */
async function uploadFile(filePath: string): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Determine content type
    const contentTypeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp"
    };

    const contentType = contentTypeMap[ext] || "image/jpeg";
    const file = new File([fileBuffer], fileName, { type: contentType });

    console.log(`  Uploading ${fileName}...`);
    const url = await fal.storage.upload(file);
    return url;
}

/**
 * Download a file from URL to local path
 */
async function downloadFile(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
}

/**
 * Upscale a single image
 */
async function upscaleImage(
    inputPath: string,
    outputPath: string,
    options: Omit<UpscaleOptions, "inputDir" | "outputDir" | "concurrency">
): Promise<void> {
    // Upload the image
    const imageUrl = await uploadFile(inputPath);

    console.log(`  Processing with fal AI...`);

    // Call the upscale API
    const result = await fal.subscribe("fal-ai/seedvr/upscale/image", {
        input: {
            image_url: imageUrl,
            upscale_factor: options.upscaleFactor || 2,
            // @ts-ignore
            output_format: options.outputFormat || "jpg",
            noise_scale: options.noiseScale || 0.1,
            target_resolution: options.targetResolution || "1080p",
            upscale_mode: options.upscaleMode || "factor",
        },
        logs: true,
        onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
                update.logs.map((log) => log.message).forEach(msg => console.log(`    ${msg}`));
            }
        },
    });

    // Download the result
    if (result.data && result.data.image && result.data.image.url) {
        console.log(`  Downloading result...`);
        await downloadFile(result.data.image.url, outputPath);
    } else {
        throw new Error("No image URL in result");
    }
}

/**
 * Process images in batches with concurrency control
 */
async function processBatch(
    files: string[],
    processor: (file: string, index: number) => Promise<UpscaleResult>,
    concurrency: number
): Promise<UpscaleResult[]> {
    const results: UpscaleResult[] = [];

    for (let i = 0; i < files.length; i += concurrency) {
        const batch = files.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map((file, idx) => processor(file, i + idx))
        );
        results.push(...batchResults);
    }

    return results;
}

/**
 * Batch upscale all images in a directory
 */
async function batchUpscale(options: UpscaleOptions): Promise<UpscaleResult[]> {
    const {
        inputDir,
        outputDir,
        concurrency = 3,
        ...upscaleOptions
    } = options;

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get all image files
    const imageFiles = getImageFiles(inputDir);
    console.log(`Found ${imageFiles.length} images to upscale`);
    console.log(`Using concurrency: ${concurrency}\n`);

    if (imageFiles.length === 0) {
        console.log("No images found to process");
        return [];
    }

    // Process each image
    const results = await processBatch(
        imageFiles,
        async (fileName, index) => {
            const inputPath = path.join(inputDir, fileName);
            const outputFileName = `${path.parse(fileName).name}_upscaled${path.extname(fileName)}`;
            const outputPath = path.join(outputDir, outputFileName);

            console.log(`\n[${index + 1}/${imageFiles.length}] Processing: ${fileName}`);

            try {
                await upscaleImage(inputPath, outputPath, upscaleOptions);
                console.log(`  ✓ Saved to: ${outputPath}`);
                return {
                    fileName,
                    success: true,
                    outputPath
                };
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`  ✗ Failed: ${errorMsg}`);
                return {
                    fileName,
                    success: false,
                    error: errorMsg
                };
            }
        },
        concurrency
    );

    return results;
}

/**
 * Main function
 */
async function main() {
    // Parse command line arguments or use defaults
    const inputDir = process.argv[2] || "./input";
    const outputDir = process.argv[3] || "./output";

    console.log("=== Batch Image Upscaler ===\n");
    console.log(`Input directory: ${inputDir}`);
    console.log(`Output directory: ${outputDir}\n`);

    const results = await batchUpscale({
        inputDir,
        outputDir,
        upscaleMode: "factor",
        upscaleFactor: 2,
        noiseScale: 0.1,
        outputFormat: "jpg",
        concurrency: 3 // Process 3 images at a time
    });

    // Print summary
    console.log("\n=== Summary ===");
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`Total: ${results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
        console.log("\nFailed files:");
        results.filter(r => !r.success).forEach(r => {
            console.log(`  - ${r.fileName}: ${r.error}`);
        });
    }
}

// Run the main function
main().catch(console.error);