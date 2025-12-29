# LoRA Directory

Place your SDXL LoRA `.safetensors` files in this directory.

## Usage

LoRAs (Low-Rank Adaptation) are used to fine-tune the model for specific styles or subjects without requiring a full model retrain.

### How to Add LoRAs

1. Download SDXL-compatible LoRA files (`.safetensors` format)
2. Place them in this directory
3. The system will automatically detect them
4. Use the `/api/fill/loras` endpoint to list available LoRAs

### Using LoRAs via API

When calling the `/api/fill/fill` endpoint, you can specify:

- `lora_names`: Comma-separated list of LoRA names (without the .safetensors extension)
- `lora_scales`: Comma-separated list of scales (0.0 to 2.0, typically 0.5 to 1.0)

**Example:**
```
lora_names: "style_anime,detail_enhancer"
lora_scales: "0.8,1.0"
```

### Notes

- LoRA files must be compatible with SDXL
- Multiple LoRAs can be used simultaneously
- Higher scales increase the LoRA's effect (1.0 is default)
- LoRAs are applied during model loading and fused with the base model
