/**
 * Kong WBGT (Wet Bulb Globe Temperature) Calculation Engine
 *
 * Implementation of the Kong et al. method for estimating WBGT from standard
 * meteorological variables. This is a client-side calculation engine for use
 * in Next.js applications.
 *
 * References:
 * - Kong, Q., & Huber, M. (2022). "Explicit calculations of wet-bulb globe
 *   temperature compared with wind tunnel measurements"
 * - ISO 7243:2017 - Heat stress assessment
 *
 * @module kong-wbgt
 */

/**
 * Parameters for WBGT calculation
 */
export interface WBGTParams {
  /** Air temperature in degrees Celsius */
  temperature: number;
  /** Relative humidity as percentage (0-100) */
  relativeHumidity: number;
  /** Wind speed in meters per second */
  windSpeed: number;
  /** Solar radiation in Watts per square meter */
  solarRadiation: number;
  /** Latitude in decimal degrees */
  latitude: number;
  /** Longitude in decimal degrees */
  longitude: number;
  /** Timestamp for the calculation */
  timestamp: Date;
}

/**
 * Result of WBGT calculation
 */
export interface WBGTResult {
  /** Wet Bulb Globe Temperature in °C */
  wbgt: number;
  /** Globe temperature in °C */
  globeTemp: number;
  /** Natural wet bulb temperature in °C */
  wetBulbTemp: number;
  /** Black globe temperature in °C (same as globeTemp) */
  blackGlobeTemp: number;
}

/**
 * Model ensemble data for statistical analysis
 */
export interface ModelEnsemble {
  /** Name of the weather model */
  modelName: string;
  /** Array of WBGT values from this model */
  wbgtValues: number[];
}

/**
 * Statistical ensemble results
 */
export interface EnsembleStats {
  /** Mean WBGT across all models */
  mean: number[];
  /** Standard deviation across models */
  stddev: number[];
  /** Minimum WBGT across models */
  min: number[];
  /** Maximum WBGT across models */
  max: number[];
}

/**
 * Physical constants used in calculations
 */
const CONSTANTS = {
  /** Stefan-Boltzmann constant (W/m²/K⁴) */
  STEFAN_BOLTZMANN: 5.67e-8,
  /** Emissivity of black globe */
  GLOBE_EMISSIVITY: 0.95,
  /** Absorptivity of black globe for solar radiation */
  GLOBE_ABSORPTIVITY: 0.95,
  /** Standard globe diameter in meters */
  GLOBE_DIAMETER: 0.15,
  /** Specific heat of air at constant pressure (J/kg/K) */
  CP_AIR: 1005,
  /** Gas constant for dry air (J/kg/K) */
  R_DRY_AIR: 287.05,
  /** Latent heat of vaporization at 0°C (J/kg) */
  L_VAPORIZATION: 2.501e6,
  /** Psychrometric constant (Pa/K) */
  PSYCHROMETRIC_CONSTANT: 66.5,
} as const;

/**
 * Calculate saturation vapor pressure using Magnus-Tetens formula
 *
 * @param temperature - Air temperature in °C
 * @returns Saturation vapor pressure in Pa
 */
function calculateSaturationVaporPressure(temperature: number): number {
  // Magnus-Tetens formula (Alduchov and Eskridge, 1996)
  const a = 17.625;
  const b = 243.04; // °C
  const exponent = (a * temperature) / (b + temperature);
  return 610.94 * Math.exp(exponent); // Pa
}

/**
 * Calculate natural wet bulb temperature using Stull approximation
 *
 * This uses the Stull (2011) approximation which is accurate to ±1°C
 * for typical atmospheric conditions.
 *
 * Reference: Stull, R. (2011). "Wet-Bulb Temperature from Relative Humidity
 * and Air Temperature". Journal of Applied Meteorology and Climatology.
 *
 * @param Ta - Air temperature in °C
 * @param RH - Relative humidity as percentage (0-100)
 * @returns Natural wet bulb temperature in °C
 */
export function calculateWetBulbTemperature(Ta: number, RH: number): number {
  // Validate inputs
  if (RH < 0 || RH > 100) {
    throw new Error(`Relative humidity must be between 0 and 100, got ${RH}`);
  }

  // Stull approximation
  const Tw = Ta * Math.atan(0.151977 * Math.sqrt(RH + 8.313659))
    + Math.atan(Ta + RH)
    - Math.atan(RH - 1.676331)
    + 0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH)
    - 4.686035;

  return Tw;
}

/**
 * Calculate convective heat transfer coefficient for the globe
 *
 * Based on forced convection correlations for flow over a sphere
 *
 * @param windSpeed - Wind speed in m/s
 * @param globeDiameter - Globe diameter in meters
 * @returns Convective heat transfer coefficient in W/m²/K
 */
function calculateConvectiveCoefficient(
  windSpeed: number,
  globeDiameter: number = CONSTANTS.GLOBE_DIAMETER
): number {
  // Ensure minimum wind speed to avoid division by zero
  const v = Math.max(windSpeed, 0.1);

  // Kinematic viscosity of air at 20°C (m²/s)
  const nu = 1.5e-5;

  // Thermal conductivity of air (W/m/K)
  const k = 0.026;

  // Reynolds number
  const Re = (v * globeDiameter) / nu;

  // Nusselt number for flow over sphere (Whitaker correlation)
  // Valid for 0.71 < Pr < 380 and 3.5 < Re < 76,000
  const Pr = 0.71; // Prandtl number for air
  const Nu = 2 + (0.4 * Math.sqrt(Re) + 0.06 * Math.pow(Re, 2/3)) * Math.pow(Pr, 0.4);

  // Convective heat transfer coefficient
  const h = (Nu * k) / globeDiameter;

  return h;
}

/**
 * Calculate solar altitude angle
 *
 * @param latitude - Latitude in decimal degrees
 * @param timestamp - Time of calculation
 * @returns Solar altitude angle in radians
 */
function calculateSolarAltitude(latitude: number, timestamp: Date): number {
  const dayOfYear = Math.floor(
    (timestamp.getTime() - new Date(timestamp.getFullYear(), 0, 0).getTime()) / 86400000
  );

  // Solar declination (radians)
  const declination = (23.45 * Math.PI / 180) * Math.sin(
    (2 * Math.PI / 365) * (dayOfYear - 81)
  );

  // Hour angle (radians)
  const hourAngle = (timestamp.getHours() + timestamp.getMinutes() / 60 - 12) * (Math.PI / 12);

  // Latitude in radians
  const latRad = latitude * Math.PI / 180;

  // Solar altitude angle
  const altitude = Math.asin(
    Math.sin(latRad) * Math.sin(declination) +
    Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle)
  );

  return Math.max(0, altitude); // Cannot be negative
}

/**
 * Calculate black globe temperature using Kong method
 *
 * This solves the heat balance equation for a black globe thermometer:
 * Solar radiation absorbed + Longwave radiation absorbed =
 * Longwave radiation emitted + Convective heat loss
 *
 * @param Ta - Air temperature in °C
 * @param SR - Solar radiation in W/m²
 * @param wind - Wind speed in m/s
 * @param latitude - Latitude in decimal degrees (default 0)
 * @param timestamp - Timestamp for solar angle calculation
 * @returns Black globe temperature in °C
 */
export function calculateGlobeTemperature(
  Ta: number,
  SR: number,
  wind: number,
  latitude: number = 0,
  timestamp: Date = new Date()
): number {
  // Handle nighttime conditions (no solar radiation)
  if (SR <= 0) {
    // At night, globe temperature approaches air temperature
    // With slight elevation due to longwave radiation
    return Ta + 0.5;
  }

  // Convert air temperature to Kelvin
  const TaK = Ta + 273.15;

  // Calculate convective heat transfer coefficient
  const h = calculateConvectiveCoefficient(wind);

  // Calculate solar altitude for angle correction
  const solarAltitude = calculateSolarAltitude(latitude, timestamp);

  // Effective solar radiation on sphere
  // A sphere intercepts π*r² but has surface area 4π*r², giving factor of 0.25
  // Additional factor for angle of incidence
  const solarFactor = Math.sin(solarAltitude) > 0.1 ? Math.sin(solarAltitude) : 0.1;
  const effectiveSolar = 0.25 * CONSTANTS.GLOBE_ABSORPTIVITY * SR * solarFactor;

  // Iterative solution for globe temperature
  // Initial guess: air temperature plus solar heating
  let TgK = TaK + (effectiveSolar / h);

  // Newton-Raphson iteration (typically converges in 3-5 iterations)
  for (let i = 0; i < 10; i++) {
    // Heat balance equation
    const radiation = CONSTANTS.STEFAN_BOLTZMANN * CONSTANTS.GLOBE_EMISSIVITY *
                     (Math.pow(TgK, 4) - Math.pow(TaK, 4));
    const convection = h * (TgK - TaK);
    const balance = effectiveSolar - radiation - convection;

    // Derivative for Newton-Raphson
    const dBalance = -4 * CONSTANTS.STEFAN_BOLTZMANN * CONSTANTS.GLOBE_EMISSIVITY *
                     Math.pow(TgK, 3) - h;

    // Update estimate
    const TgK_new = TgK - balance / dBalance;

    // Check convergence
    if (Math.abs(TgK_new - TgK) < 0.01) {
      break;
    }

    TgK = TgK_new;
  }

  // Convert back to Celsius
  return TgK - 273.15;
}

/**
 * Calculate WBGT using the Kong method
 *
 * The Kong method provides an explicit calculation of WBGT from standard
 * meteorological variables, suitable for forecasting applications.
 *
 * WBGT = 0.7 * Tnwb + 0.2 * Tg + 0.1 * Ta
 *
 * where:
 * - Tnwb = Natural wet bulb temperature
 * - Tg = Black globe temperature
 * - Ta = Air temperature
 *
 * @param params - WBGT calculation parameters
 * @returns WBGT result with component temperatures
 */
export function calculateKongWBGT(params: WBGTParams): WBGTResult {
  const {
    temperature,
    relativeHumidity,
    windSpeed,
    solarRadiation,
    latitude,
    timestamp
  } = params;

  // Validate inputs
  if (temperature < -50 || temperature > 60) {
    console.warn(`Temperature ${temperature}°C is outside typical range (-50 to 60°C)`);
  }

  if (relativeHumidity < 0 || relativeHumidity > 100) {
    throw new Error(`Relative humidity must be between 0 and 100, got ${relativeHumidity}`);
  }

  if (windSpeed < 0) {
    throw new Error(`Wind speed cannot be negative, got ${windSpeed}`);
  }

  if (solarRadiation < 0) {
    throw new Error(`Solar radiation cannot be negative, got ${solarRadiation}`);
  }

  // Calculate component temperatures
  const wetBulbTemp = calculateWetBulbTemperature(temperature, relativeHumidity);
  const globeTemp = calculateGlobeTemperature(
    temperature,
    solarRadiation,
    windSpeed,
    latitude,
    timestamp
  );

  // Calculate WBGT using standard formula
  // For outdoor conditions with solar radiation
  const wbgt = 0.7 * wetBulbTemp + 0.2 * globeTemp + 0.1 * temperature;

  return {
    wbgt: Number(wbgt.toFixed(2)),
    globeTemp: Number(globeTemp.toFixed(2)),
    wetBulbTemp: Number(wetBulbTemp.toFixed(2)),
    blackGlobeTemp: Number(globeTemp.toFixed(2)), // Same as globeTemp
  };
}

/**
 * Calculate statistical ensemble metrics across multiple weather models
 *
 * This function computes mean, standard deviation, minimum, and maximum
 * values across multiple model predictions at each forecast time step.
 *
 * @param wbgtArrays - Array of model ensembles with WBGT values
 * @returns Ensemble statistics for each time step
 * @throws Error if arrays have inconsistent lengths or if no data provided
 */
export function calculateEnsembleStats(wbgtArrays: ModelEnsemble[]): EnsembleStats {
  if (!wbgtArrays || wbgtArrays.length === 0) {
    throw new Error('No ensemble data provided');
  }

  // Validate that all arrays have the same length
  const length = wbgtArrays[0].wbgtValues.length;
  if (!wbgtArrays.every(model => model.wbgtValues.length === length)) {
    throw new Error('All model arrays must have the same length');
  }

  if (length === 0) {
    throw new Error('Model arrays cannot be empty');
  }

  const numModels = wbgtArrays.length;
  const mean: number[] = [];
  const stddev: number[] = [];
  const min: number[] = [];
  const max: number[] = [];

  // Calculate statistics for each time step
  for (let i = 0; i < length; i++) {
    // Extract values from all models for this time step
    const values = wbgtArrays.map(model => model.wbgtValues[i]);

    // Filter out invalid values (NaN, Infinity)
    const validValues = values.filter(v => Number.isFinite(v));

    if (validValues.length === 0) {
      // All values are invalid at this time step
      mean.push(NaN);
      stddev.push(NaN);
      min.push(NaN);
      max.push(NaN);
      continue;
    }

    // Calculate mean
    const meanValue = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
    mean.push(Number(meanValue.toFixed(2)));

    // Calculate standard deviation
    if (validValues.length > 1) {
      const variance = validValues.reduce((sum, v) => {
        return sum + Math.pow(v - meanValue, 2);
      }, 0) / validValues.length;
      stddev.push(Number(Math.sqrt(variance).toFixed(2)));
    } else {
      stddev.push(0);
    }

    // Calculate min and max
    min.push(Number(Math.min(...validValues).toFixed(2)));
    max.push(Number(Math.max(...validValues).toFixed(2)));
  }

  return { mean, stddev, min, max };
}

/**
 * Helper function to categorize WBGT heat stress risk
 *
 * Based on ISO 7243 and military/athletic heat stress guidelines
 *
 * @param wbgt - WBGT value in °C
 * @returns Risk category and description
 */
export function categorizeHeatStress(wbgt: number): {
  category: 'low' | 'moderate' | 'high' | 'very_high' | 'extreme';
  label: string;
  description: string;
} {
  if (wbgt < 18) {
    return {
      category: 'low',
      label: 'Low Risk',
      description: 'Heat stress risk is minimal. Normal activities can proceed.',
    };
  } else if (wbgt < 23) {
    return {
      category: 'moderate',
      label: 'Moderate Risk',
      description: 'Use caution during prolonged activity. Stay hydrated.',
    };
  } else if (wbgt < 28) {
    return {
      category: 'high',
      label: 'High Risk',
      description: 'Reduce activity intensity. Increase rest breaks and hydration.',
    };
  } else if (wbgt < 31) {
    return {
      category: 'very_high',
      label: 'Very High Risk',
      description: 'Limit strenuous activity. Frequent breaks required.',
    };
  } else {
    return {
      category: 'extreme',
      label: 'Extreme Risk',
      description: 'Avoid strenuous outdoor activity. High risk of heat illness.',
    };
  }
}

/**
 * Batch calculate WBGT for multiple time points
 *
 * Useful for processing weather forecast data
 *
 * @param paramsList - Array of WBGT parameters for different times
 * @returns Array of WBGT results
 */
export function calculateBatchWBGT(paramsList: WBGTParams[]): WBGTResult[] {
  return paramsList.map(params => calculateKongWBGT(params));
}
