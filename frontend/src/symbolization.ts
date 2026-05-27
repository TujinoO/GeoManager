export type Anchor =
  | 'center'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export type Alignment = 'map' | 'viewport' | 'auto';
export type MapViewport = 'map' | 'viewport';
export type PointSymbolMode = 'circle' | 'symbol';
export type SymbolPlacement = 'point' | 'line' | 'line-center';
export type SymbolZOrder = 'auto' | 'viewport-y' | 'source';
export type TextJustify = 'auto' | 'left' | 'center' | 'right';
export type TextTransform = 'none' | 'uppercase' | 'lowercase';
export type IconTextFit = 'none' | 'width' | 'height' | 'both';
export type LineCap = 'butt' | 'round' | 'square';
export type LineJoin = 'bevel' | 'round' | 'miter' | 'none';

export interface GroupSymbolization {
  opacity: number;
}

export interface CircleSymbolization {
  circleColor: string;
  circleRadius: number;
  circleBlur: number;
  circleOpacity: number;
  circlePitchAlignment: MapViewport;
  circlePitchScale: MapViewport;
  circleSortKey: number;
  circleStrokeColor: string;
  circleStrokeOpacity: number;
  circleStrokeWidth: number;
  circleTranslate: [number, number];
  circleTranslateAnchor: MapViewport;
  circleEmissiveStrength: number;
}

export interface SymbolLayerSymbolization {
  symbolPlacement: SymbolPlacement;
  symbolSpacing: number;
  symbolAvoidEdges: boolean;
  symbolSortKey: number;
  symbolZOrder: SymbolZOrder;
  iconImage: string;
  iconSize: number;
  iconSizeScaleRange: [number, number];
  iconAllowOverlap: boolean;
  iconIgnorePlacement: boolean;
  iconOptional: boolean;
  iconAnchor: Anchor;
  iconOffset: [number, number];
  iconPadding: number;
  iconKeepUpright: boolean;
  iconRotate: number;
  iconPitchAlignment: Alignment;
  iconRotationAlignment: Alignment;
  iconTextFit: IconTextFit;
  iconTextFitPadding: [number, number, number, number];
  iconColor: string;
  iconOpacity: number;
  iconHaloColor: string;
  iconHaloWidth: number;
  iconHaloBlur: number;
  iconTranslate: [number, number];
  iconTranslateAnchor: MapViewport;
  iconEmissiveStrength: number;
  iconColorBrightnessMin: number;
  iconColorBrightnessMax: number;
  iconColorContrast: number;
  iconColorSaturation: number;
  iconOcclusionOpacity: number;
  textField: string;
  textFont: string[];
  textSize: number;
  textMaxWidth: number;
  textLineHeight: number;
  textLetterSpacing: number;
  textJustify: TextJustify;
  textAnchor: Anchor;
  textOffset: [number, number];
  textRadialOffset: number;
  textVariableAnchor: Anchor[];
  textWritingMode: Array<'horizontal' | 'vertical'>;
  textPadding: number;
  textKeepUpright: boolean;
  textAllowOverlap: boolean;
  textIgnorePlacement: boolean;
  textOptional: boolean;
  textRotate: number;
  textPitchAlignment: Alignment;
  textRotationAlignment: Alignment;
  textTransform: TextTransform;
  textColor: string;
  textOpacity: number;
  textHaloColor: string;
  textHaloWidth: number;
  textHaloBlur: number;
  textTranslate: [number, number];
  textTranslateAnchor: MapViewport;
  textEmissiveStrength: number;
  textOcclusionOpacity: number;
}

export interface LineSymbolization {
  lineColor: string;
  lineOpacity: number;
  lineWidth: number;
  lineBlur: number;
  lineCap: LineCap;
  lineJoin: LineJoin;
  lineMiterLimit: number;
  lineRoundLimit: number;
  lineOffset: number;
  lineGapWidth: number;
  lineDasharray: [number, number];
  lineTranslate: [number, number];
  lineTranslateAnchor: MapViewport;
  lineEmissiveStrength: number;
}

export interface FillSymbolization {
  fillColor: string;
  fillOpacity: number;
  fillOutlineColor: string;
  fillAntialias: boolean;
  fillSortKey: number;
  fillTranslate: [number, number];
  fillTranslateAnchor: MapViewport;
  fillEmissiveStrength: number;
}

export interface VectorSymbolization {
  opacity: number;
  pointMode: PointSymbolMode;
  circle: CircleSymbolization;
  symbol: SymbolLayerSymbolization;
  line: LineSymbolization;
  fill: FillSymbolization;
}

export type RasterRenderMode = 'gray' | 'rgb' | 'pseudocolor' | 'unique';
export type RasterLoadMode = 'image' | 'xyz';

export interface RasterStretchBand {
  min: number;
  max: number;
}

export interface RasterUniqueValue {
  value: number;
  color: string;
  label: string;
}

export interface RasterSymbolization {
  opacity: number;
  loadMode: RasterLoadMode;
  mode: RasterRenderMode;
  bands: number[];
  stretch: {
    enabled: boolean;
    type: 'minmax';
    perBand: Record<string, RasterStretchBand>;
  };
  palette: 'poplar' | 'viridis' | 'terrain' | 'thermal';
  uniqueValues: RasterUniqueValue[];
}

export const defaultGroupSymbolization: GroupSymbolization = {
  opacity: 100,
};

export const defaultVectorSymbolization: VectorSymbolization = {
  opacity: 90,
  pointMode: 'circle',
  circle: {
    circleColor: '#d9a441',
    circleRadius: 6,
    circleBlur: 0,
    circleOpacity: 1,
    circlePitchAlignment: 'viewport',
    circlePitchScale: 'map',
    circleSortKey: 0,
    circleStrokeColor: '#ffffff',
    circleStrokeOpacity: 1,
    circleStrokeWidth: 1.2,
    circleTranslate: [0, 0],
    circleTranslateAnchor: 'map',
    circleEmissiveStrength: 0,
  },
  symbol: {
    symbolPlacement: 'point',
    symbolSpacing: 250,
    symbolAvoidEdges: false,
    symbolSortKey: 0,
    symbolZOrder: 'auto',
    iconImage: 'marker-15',
    iconSize: 1,
    iconSizeScaleRange: [0.8, 2],
    iconAllowOverlap: true,
    iconIgnorePlacement: false,
    iconOptional: false,
    iconAnchor: 'center',
    iconOffset: [0, 0],
    iconPadding: 2,
    iconKeepUpright: false,
    iconRotate: 0,
    iconPitchAlignment: 'auto',
    iconRotationAlignment: 'auto',
    iconTextFit: 'none',
    iconTextFitPadding: [0, 0, 0, 0],
    iconColor: '#2f7d62',
    iconOpacity: 1,
    iconHaloColor: '#ffffff',
    iconHaloWidth: 0,
    iconHaloBlur: 0,
    iconTranslate: [0, 0],
    iconTranslateAnchor: 'map',
    iconEmissiveStrength: 0,
    iconColorBrightnessMin: 0,
    iconColorBrightnessMax: 1,
    iconColorContrast: 0,
    iconColorSaturation: 0,
    iconOcclusionOpacity: 1,
    textField: '',
    textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'],
    textSize: 12,
    textMaxWidth: 10,
    textLineHeight: 1.2,
    textLetterSpacing: 0,
    textJustify: 'auto',
    textAnchor: 'center',
    textOffset: [0, 1.2],
    textRadialOffset: 0,
    textVariableAnchor: [],
    textWritingMode: ['horizontal'],
    textPadding: 2,
    textKeepUpright: true,
    textAllowOverlap: false,
    textIgnorePlacement: false,
    textOptional: false,
    textRotate: 0,
    textPitchAlignment: 'auto',
    textRotationAlignment: 'auto',
    textTransform: 'none',
    textColor: '#173f39',
    textOpacity: 1,
    textHaloColor: '#ffffff',
    textHaloWidth: 1,
    textHaloBlur: 0,
    textTranslate: [0, 0],
    textTranslateAnchor: 'map',
    textEmissiveStrength: 0,
    textOcclusionOpacity: 1,
  },
  line: {
    lineColor: '#174f46',
    lineOpacity: 1,
    lineWidth: 1.4,
    lineBlur: 0,
    lineCap: 'round',
    lineJoin: 'round',
    lineMiterLimit: 2,
    lineRoundLimit: 1.05,
    lineOffset: 0,
    lineGapWidth: 0,
    lineDasharray: [1, 0],
    lineTranslate: [0, 0],
    lineTranslateAnchor: 'map',
    lineEmissiveStrength: 0,
  },
  fill: {
    fillColor: '#2f7d62',
    fillOpacity: 0.72,
    fillOutlineColor: '#174f46',
    fillAntialias: true,
    fillSortKey: 0,
    fillTranslate: [0, 0],
    fillTranslateAnchor: 'map',
    fillEmissiveStrength: 0,
  },
};

export const defaultRasterSymbolization: RasterSymbolization = {
  opacity: 90,
  loadMode: 'image',
  mode: 'gray',
  bands: [1],
  stretch: {
    enabled: true,
    type: 'minmax',
    perBand: {
      '1': { min: 0, max: 255 },
    },
  },
  palette: 'poplar',
  uniqueValues: [
    { value: 0, color: '#00000000', label: '0' },
    { value: 1, color: '#2f7d62', label: '1' },
  ],
};

export function cloneDefaultGroupSymbolization(): GroupSymbolization {
  return { ...defaultGroupSymbolization };
}

export function cloneDefaultVectorSymbolization(): VectorSymbolization {
  return {
    ...defaultVectorSymbolization,
    circle: { ...defaultVectorSymbolization.circle },
    symbol: {
      ...defaultVectorSymbolization.symbol,
      iconOffset: [...defaultVectorSymbolization.symbol.iconOffset],
      iconSizeScaleRange: [...defaultVectorSymbolization.symbol.iconSizeScaleRange],
      iconTextFitPadding: [...defaultVectorSymbolization.symbol.iconTextFitPadding],
      iconTranslate: [...defaultVectorSymbolization.symbol.iconTranslate],
      textFont: [...defaultVectorSymbolization.symbol.textFont],
      textOffset: [...defaultVectorSymbolization.symbol.textOffset],
      textTranslate: [...defaultVectorSymbolization.symbol.textTranslate],
      textVariableAnchor: [...defaultVectorSymbolization.symbol.textVariableAnchor],
      textWritingMode: [...defaultVectorSymbolization.symbol.textWritingMode],
    },
    line: {
      ...defaultVectorSymbolization.line,
      lineDasharray: [...defaultVectorSymbolization.line.lineDasharray],
      lineTranslate: [...defaultVectorSymbolization.line.lineTranslate],
    },
    fill: {
      ...defaultVectorSymbolization.fill,
      fillTranslate: [...defaultVectorSymbolization.fill.fillTranslate],
    },
  };
}

export function rasterSymbolizationFromRules(
  rules: Partial<RasterSymbolization> | Record<string, unknown> | undefined,
): RasterSymbolization {
  const raw = (rules ?? {}) as Partial<RasterSymbolization>;
  return {
    ...defaultRasterSymbolization,
    ...raw,
    opacity: typeof raw.opacity === 'number' ? raw.opacity : defaultRasterSymbolization.opacity,
    loadMode: raw.loadMode ?? defaultRasterSymbolization.loadMode,
    mode: raw.mode ?? defaultRasterSymbolization.mode,
    bands: Array.isArray(raw.bands) && raw.bands.length > 0 ? raw.bands.map(Number) : [...defaultRasterSymbolization.bands],
    stretch: {
      ...defaultRasterSymbolization.stretch,
      ...(raw.stretch ?? {}),
      perBand: {
        ...defaultRasterSymbolization.stretch.perBand,
        ...(raw.stretch?.perBand ?? {}),
      },
    },
    uniqueValues: Array.isArray(raw.uniqueValues)
      ? raw.uniqueValues.map((item) => ({ ...item }))
      : defaultRasterSymbolization.uniqueValues.map((item) => ({ ...item })),
  };
}

export function cloneDefaultRasterSymbolization(): RasterSymbolization {
  return rasterSymbolizationFromRules(defaultRasterSymbolization);
}
