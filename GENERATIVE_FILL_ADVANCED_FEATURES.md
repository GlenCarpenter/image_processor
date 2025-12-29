# Generative Fill - Advanced Features Guide

This guide covers the advanced features for generative fill including custom schedulers and LoRA support.

## Schedulers

Schedulers control the denoising process during image generation. Different schedulers can produce different results in terms of quality, speed, and style.

### Available Schedulers

- **DDIM** - Fast and deterministic, good for quick results
- **DPMSolverMultistep** - High quality with fewer steps, recommended for most use cases
- **EulerAncestralDiscrete** - Non-deterministic, can produce more varied results
- **EulerDiscrete** - Deterministic version of Euler
- **PNDM** - Pseudo Numerical Methods, good balance of speed and quality
- **LMSDiscrete** - Linear Multi-Step, smooth results

### Usage

Specify the scheduler when making API calls:

```python
# Example API call
{
    "file": <image_file>,
    "mask": <mask_file>,
    "prompt": "a beautiful sunset",
    "model_name": "realvisxlV50_v50Bakedvae",
    "scheduler": "DPMSolverMultistep"
}
```

## LoRA Support

LoRAs (Low-Rank Adaptations) allow you to customize the model's output without retraining the entire model. They're useful for:
- Style modifications
- Subject-specific details
- Quality enhancements
- Artistic effects

### Setting Up LoRAs

1. Download SDXL-compatible LoRA files (`.safetensors` format)
2. Place them in the `lora/` directory
3. Restart the application or call the `/api/fill/loras` endpoint to verify they're detected

### Using LoRAs

Specify LoRAs when making API calls:

```python
# Single LoRA
{
    "lora_names": "my_style_lora",
    "lora_scales": "1.0"
}

# Multiple LoRAs
{
    "lora_names": "style_anime,detail_enhancer,lighting_fix",
    "lora_scales": "0.8,1.0,0.5"
}
```

### LoRA Scale Guidelines

- **0.0 - 0.3**: Subtle effect
- **0.4 - 0.7**: Moderate effect
- **0.8 - 1.2**: Strong effect (recommended range)
- **1.3 - 2.0**: Very strong effect (may oversaturate)

## Complete Example

```python
import requests

url = "http://localhost:8000/api/fill/fill"

files = {
    "file": open("image.png", "rb"),
    "mask": open("mask.png", "rb")
}

data = {
    "prompt": "a serene mountain landscape at golden hour",
    "negative_prompt": "blurry, low quality, distorted",
    "model_name": "realvisxlV50_v50Bakedvae",
    "num_inference_steps": 35,
    "guidance_scale": 8.0,
    "strength": 1.0,
    "seed": 42,
    "lora_names": "landscape_enhancer,lighting_pro",
    "lora_scales": "0.9,0.7",
    "scheduler": "DPMSolverMultistep"
}

response = requests.post(url, files=files, data=data)
result = response.json()
```

## API Endpoints

### List Available Models
```
GET /api/fill/models
```

### List Available LoRAs
```
GET /api/fill/loras
```

### Perform Generative Fill
```
POST /api/fill/fill
```

Parameters:
- `file` (required): Image file
- `mask` (required): Mask file
- `prompt` (required): Generation prompt
- `model_name` (required): SDXL model to use
- `negative_prompt`: What to avoid
- `num_inference_steps`: 20-50 (default: 30)
- `guidance_scale`: 1-20 (default: 7.5)
- `strength`: 0-1 (default: 1.0)
- `seed`: Random seed
- `lora_names`: Comma-separated LoRA names
- `lora_scales`: Comma-separated scales
- `scheduler`: Scheduler type

## Tips

1. **For Speed**: Use `DPMSolverMultistep` with 20-25 steps
2. **For Quality**: Use `DDIM` or `DPMSolverMultistep` with 30-40 steps
3. **For Variety**: Use `EulerAncestralDiscrete` with different seeds
4. **LoRA Stacking**: Combine multiple LoRAs for unique effects, but keep total scales under 3.0
5. **Testing**: Start with default settings and adjust one parameter at a time

## Troubleshooting

- **LoRA not loading**: Ensure it's SDXL-compatible and in `.safetensors` format
- **Out of memory**: Reduce number of LoRAs or use lower inference steps
- **Unexpected results**: Try different schedulers or adjust LoRA scales
- **LoRA not found**: Check the filename matches exactly (case-sensitive)
