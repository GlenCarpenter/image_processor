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

interface QwenEditOptions {
    inputDir: string;
    outputDir: string;
    prompt?: string;
    guidanceScale?: number;
    numInferenceSteps?: number;
    acceleration?: "regular" | "fast";
    negativePrompt?: string;
    enableSafetyChecker?: boolean;
    outputFormat?: "png" | "jpg" | "webp";
    numImages?: number;
    loraScale?: number;
    concurrency?: number;
}

interface EditResult {
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
 * Edit a single image using Qwen
 */
async function editImage(
    inputPath: string,
    outputPath: string,
    options: Omit<QwenEditOptions, "inputDir" | "outputDir" | "concurrency">
): Promise<void> {
    // Upload the image
    const imageUrl = await uploadFile(inputPath);

    console.log(`  Processing with Qwen AI...`);

    // Call the edit API
    const result = await fal.subscribe("fal-ai/qwen-image-edit-2511-lora-gallery/remove-element", {
        input: {
            image_urls: [imageUrl],
            prompt: options.prompt || "Remove all text from the image",
            guidance_scale: options.guidanceScale || 1,
            num_inference_steps: options.numInferenceSteps || 6,
            acceleration: options.acceleration || "regular",
            negative_prompt: options.negativePrompt || " ",
            enable_safety_checker: options.enableSafetyChecker || false,
            output_format: options.outputFormat || "png",
            num_images: options.numImages || 1,
            lora_scale: options.loraScale || 1
        },
        logs: true,
        onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
                update.logs.map((log) => log.message).forEach(msg => console.log(`    ${msg}`));
            }
        },
    });

    // Download the result
    if (result.data && result.data.images && result.data.images.length > 0) {
        const imageData = result.data.images[0];
        console.log(`  Downloading result...`);
        await downloadFile(imageData.url, outputPath);
    } else {
        throw new Error("No image URL in result");
    }
}

/**
 * Process images in batches with concurrency control
 */
async function processBatch(
    files: string[],
    processor: (file: string, index: number) => Promise<EditResult>,
    concurrency: number
): Promise<EditResult[]> {
    const results: EditResult[] = [];

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
 * Batch edit all images in a directory
 */
async function batchEdit(options: QwenEditOptions): Promise<EditResult[]> {
    const {
        inputDir,
        outputDir,
        concurrency = 3,
        ...editOptions
    } = options;

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get all image files
    const imageFiles = getImageFiles(inputDir);
    console.log(`Found ${imageFiles.length} images to edit`);
    console.log(`Using concurrency: ${concurrency}`);
    console.log(`Prompt: "${editOptions.prompt || "Remove all text from the image"}"\n`);

    if (imageFiles.length === 0) {
        console.log("No images found to process");
        return [];
    }

    // Process each image
    const results = await processBatch(
        imageFiles,
        async (fileName, index) => {
            const inputPath = path.join(inputDir, fileName);
            const parsedName = path.parse(fileName);
            const outputFileName = `${parsedName.name}_edited${editOptions.outputFormat ? '.' + editOptions.outputFormat : parsedName.ext}`;
            const outputPath = path.join(outputDir, outputFileName);

            console.log(`\n[${index + 1}/${imageFiles.length}] Processing: ${fileName}`);

            try {
                await editImage(inputPath, outputPath, editOptions);
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
    const prompt = process.argv[4];

    console.log("=== Batch Qwen Image Editor ===\n");
    console.log(`Input directory: ${inputDir}`);
    console.log(`Output directory: ${outputDir}\n`);

    const results = await batchEdit({
        inputDir,
        outputDir,
        prompt: prompt || "Remove all text from the image",
        guidanceScale: 1,
        numInferenceSteps: 6,
        acceleration: "regular",
        negativePrompt: " ",
        enableSafetyChecker: false,
        outputFormat: "png",
        numImages: 1,
        loraScale: 1,
        concurrency: 3
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
