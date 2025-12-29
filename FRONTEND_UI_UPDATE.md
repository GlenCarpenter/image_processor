# Frontend UI Update - Generative Fill

## Summary

Updated [generative-fill.tsx](frontend/src/routes/generative-fill.tsx) to include controls for scheduler selection and LoRA configuration.

## Changes Made

### 1. New State Variables
```typescript
// Scheduler selection
const [selectedScheduler, setSelectedScheduler] = useState<string>('')

// LoRA management
const [availableLoras, setAvailableLoras] = useState<LoRA[]>([])
const [loadingLoras, setLoadingLoras] = useState(true)
const [selectedLoras, setSelectedLoras] = useState<LoRASelection[]>([])
```

### 2. New Interfaces
```typescript
interface LoRA {
  name: string
  path: string
  filename: string
}

interface LoRASelection {
  name: string
  scale: number
}
```

### 3. LoRA Loading
Added effect to fetch available LoRAs from `/api/fill/loras` endpoint on component mount.

### 4. Form Submission Updates
Form now includes:
- `scheduler` parameter (if selected and not "_default")
- `lora_names` parameter (comma-separated list)
- `lora_scales` parameter (comma-separated values)

### 5. New UI Components

#### Scheduler Selector
- Dropdown select with 7 options:
  - **Default (auto)** - Uses model's default scheduler
  - **DPM++ (Recommended)** - DPMSolverMultistep
  - **DDIM (Fast)** - Fast and deterministic
  - **Euler Ancestral (Varied)** - Non-deterministic with variety
  - **Euler (Stable)** - Deterministic Euler
  - **PNDM (Balanced)** - Good balance of quality/speed
  - **LMS (Smooth)** - Smooth results
- Appears after Negative Prompt input
- Optional - can leave as default

#### LoRA Manager
- Only displayed when LoRAs are available
- Features:
  - **Add LoRA dropdown** - Select from available LoRAs
  - **Selected LoRAs list** - Shows all active LoRAs
  - **Individual scale sliders** - Adjust each LoRA's influence (0.0 - 2.0)
  - **Remove button** - Remove individual LoRAs
  - **Real-time scale display** - Shows current scale value
- Scale slider range: 0.0 to 2.0 (0.1 increments)
- Recommended range: 0.5 - 1.2
- Multiple LoRAs can be combined

## UI Layout

```
┌─────────────────────────────────────────────────┐
│ SDXL Model Selection                            │
├─────────────────────────────────────────────────┤
│ Prompt (Textarea)                               │
├─────────────────────────────────────────────────┤
│ Negative Prompt (Textarea)                      │
├─────────────────────────────────────────────────┤
│ ✨ NEW: Scheduler Selection (Dropdown)          │
├─────────────────────────────────────────────────┤
│ ✨ NEW: LoRA Manager (if LoRAs available)       │
│  ┌───────────────────────────────────────────┐  │
│  │ Selected LoRA 1       [Scale: 0.8] Remove│  │
│  │ [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]    │  │
│  ├───────────────────────────────────────────┤  │
│  │ Selected LoRA 2       [Scale: 1.0] Remove│  │
│  │ [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]    │  │
│  └───────────────────────────────────────────┘  │
│  [Add LoRA... ▼]                                │
├─────────────────────────────────────────────────┤
│ Advanced Parameters                             │
│  - Inference Steps (20-50)                      │
│  - Guidance Scale (1-20)                        │
│  - Strength (0-1)                               │
│  - Seed (Optional)                              │
├─────────────────────────────────────────────────┤
│ [Generate Fill]                                 │
└─────────────────────────────────────────────────┘
```

## User Experience

### Scheduler Selection
1. Click on Scheduler dropdown
2. Choose desired scheduler or leave as "Default"
3. Hover over options for descriptions

### LoRA Usage
1. Click "Add LoRA..." dropdown
2. Select a LoRA from the list
3. LoRA appears with scale slider set to 1.0
4. Adjust scale using slider (shows real-time value)
5. Add more LoRAs as needed
6. Remove unwanted LoRAs with "Remove" button
7. Generate with combined LoRA effects

## Visual Feedback

- **Toast notifications** when LoRAs are detected
- **Real-time scale display** (e.g., "0.8", "1.0")
- **Visual LoRA cards** with clear layout
- **Descriptive tooltips** for schedulers
- **Disabled state** when no LoRAs available (section hidden)

## Technical Details

### API Integration
- Fetches LoRAs on mount: `GET /api/fill/loras`
- Sends parameters in FormData:
  ```javascript
  scheduler: "DPMSolverMultistep"
  lora_names: "lora1,lora2"
  lora_scales: "0.8,1.0"
  ```

### Error Handling
- Silent failure for LoRA loading (optional feature)
- No error toast if LoRA directory is empty
- LoRA section hidden if none available
- Prevents duplicate LoRA selection

### Performance
- LoRAs loaded once on mount
- No re-rendering on scale adjustments
- Efficient state management

## Testing Checklist

- [x] Code compiles without errors
- [x] TypeScript types correct
- [ ] Scheduler dropdown displays correctly
- [ ] LoRA section appears when LoRAs available
- [ ] LoRA section hidden when no LoRAs
- [ ] Can add multiple LoRAs
- [ ] Scale sliders work smoothly
- [ ] Can remove individual LoRAs
- [ ] Generate button includes new parameters
- [ ] Form submission includes scheduler
- [ ] Form submission includes LoRA data
- [ ] Default scheduler option works
- [ ] Empty LoRA list doesn't break UI

## Usage Examples

### Example 1: Custom Scheduler Only
```
Scheduler: DPM++ (Recommended)
LoRAs: None
→ Fast, high-quality generation
```

### Example 2: Single LoRA
```
Scheduler: Default
LoRAs: anime_style (0.9)
→ Anime-styled output
```

### Example 3: Multiple LoRAs
```
Scheduler: Euler Ancestral
LoRAs: 
  - detail_enhancer (1.0)
  - lighting_fix (0.7)
  - color_boost (0.5)
→ Enhanced details with improved lighting and colors
```

## Files Modified

1. **frontend/src/routes/generative-fill.tsx**
   - Added scheduler selection UI
   - Added LoRA management UI
   - Added API calls for LoRA loading
   - Updated form submission logic

## Future Enhancements

- [ ] Save scheduler preferences
- [ ] LoRA preview thumbnails
- [ ] Scheduler presets (Fast, Balanced, Quality)
- [ ] LoRA favorites/bookmarks
- [ ] Batch apply LoRA sets
- [ ] LoRA search/filter
- [ ] Scheduler comparison tool
