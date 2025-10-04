import type { ReplicateModel } from '../types';

export const PRESET_MODELS: ReplicateModel[] = [
  // Image Generation
  {
    owner: 'black-forest-labs',
    name: 'flux-schnell',
    description: '가장 빠른 FLUX 이미지 생성',
    runs: "0",
    category: 'image'
  },
  {
    owner: 'black-forest-labs',
    name: 'flux-1.1-pro',
    description: '고품질 FLUX Pro',
    runs: "0",
    category: 'image'
  },
  {
    owner: 'ideogram-ai',
    name: 'ideogram-v3-turbo',
    description: '빠르고 저렴한 Ideogram v3',
    runs: "0",
    category: 'image'
  },
  {
    owner: 'bytedance',
    name: 'seedream-4',
    description: '4K 해상도 이미지 생성',
    runs: "0",
    category: 'image'
  },
  {
    owner: 'google',
    name: 'imagen-4-fast',
    description: 'Google Imagen 4 빠른 버전',
    runs: "0",
    category: 'image'
  },
  {
    owner: 'qwen',
    name: 'qwen-image',
    description: '복잡한 텍스트 렌더링',
    runs: "0",
    category: 'image'
  },

  // Video Generation
  {
    owner: 'bytedance',
    name: 'seedance-1-lite',
    description: '5-10초 비디오 (480p/720p)',
    runs: "0",
    category: 'video'
  },
  {
    owner: 'bytedance',
    name: 'seedance-1-pro',
    description: '5-10초 비디오 (480p/1080p)',
    runs: "0",
    category: 'video'
  },
  {
    owner: 'pixverse',
    name: 'pixverse-v4.5',
    description: '5-8초 향상된 모션',
    runs: "0",
    category: 'video'
  },
  {
    owner: 'minimax',
    name: 'hailuo-02',
    description: '6-10초 비디오 (768p/1080p)',
    runs: "0",
    category: 'video'
  },
  {
    owner: 'google',
    name: 'veo-3-fast',
    description: '오디오 포함 비디오',
    runs: "0",
    category: 'video'
  },
  {
    owner: 'kwaivgi',
    name: 'kling-v2.1-master',
    description: '1080p 프리미엄',
    runs: "0",
    category: 'video'
  },

  // Image Editing
  {
    owner: 'google',
    name: 'nano-banana',
    description: 'Gemini 2.5 이미지 편집',
    runs: "0",
    category: 'edit'
  },
  {
    owner: 'black-forest-labs',
    name: 'flux-kontext-max',
    description: '프리미엄 텍스트 기반 편집',
    runs: "0",
    category: 'edit'
  },
  {
    owner: 'prunaai',
    name: 'flux-kontext-dev',
    description: '최적화된 Kontext',
    runs: "0",
    category: 'edit'
  },
  {
    owner: 'ideogram-ai',
    name: 'ideogram-v2-turbo',
    description: '빠른 인페인팅',
    runs: "0",
    category: 'edit'
  },
  {
    owner: 'qwen',
    name: 'qwen-image-edit',
    description: '텍스트 렌더링 편집',
    runs: "0",
    category: 'edit'
  }
];
