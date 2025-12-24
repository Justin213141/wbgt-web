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
  /** Direct beam radiation in Watts per square meter (optional, improves accuracy) */
  directRadiation?: number;
  /** Diffuse radiation in Watts per square meter (optional, improves accuracy) */
  diffuseRadiation?: number;
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
  /** Globe diameter in meters (ISO 7243 standard 150mm black globe) */
  GLOBE_DIAMETER: 0.15,
  /** Specific heat of air at constant pressure (J/kg/K) */
  CP_AIR: 1005,
  /** Gas constant for dry air (J/kg/K) */
  R_DRY_AIR: 287.05,
  /** Latent heat of vaporization at 0°C (J/kg) */
  L_VAPORIZATION: 2.501e6,
  /** Psychrometric constant (Pa/K) */
  PSYCHROMETRIC_CONSTANT: 66.5,
  /** Wick diameter in meters (Kong et al.) */
  WICK_DIAMETER: 0.007,
  /** Wick length in meters (Kong et al.) */
  WICK_LENGTH: 0.0254,
  /** Wick emissivity (wet cotton) */
  WICK_EMISSIVITY: 0.95,
  /** Wick albedo (wet cotton reflects ~40% of shortwave) */
  WICK_ALBEDO: 0.4,
  /** Molecular weight of water (kg/mol) */
  MOLECULAR_WEIGHT_WATER: 0.018015,
  /** Molecular weight of air (kg/mol) */
  MOLECULAR_WEIGHT_AIR: 0.02897,
  /** Latent heat of vaporization (J/kg) */
  LATENT_HEAT_VAPORIZATION: 2453000,
  /** Atmospheric emissivity constant */
  ATMOSPHERIC_EMISSIVITY_CONSTANT: 0.575,
  /** Atmospheric emissivity exponent */
  ATMOSPHERIC_EMISSIVITY_EXPONENT: 0.143,
  /** Minimum heat transfer coefficient for numerical stability */
  MIN_HEAT_TRANSFER_COEFFICIENT: 5.0,
  /** Standard atmospheric pressure (hPa) */
  STANDARD_PRESSURE: 1013.25,
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
 * Calculate psychrometric wet bulb temperature using Stull approximation
 *
 * This uses the Stull (2011) approximation which is accurate to ±1°C
 * for typical atmospheric conditions. This is the PSYCHROMETRIC wet bulb,
 * used as an initial estimate for the full Kong natural wet bulb calculation.
 *
 * Reference: Stull, R. (2011). "Wet-Bulb Temperature from Relative Humidity
 * and Air Temperature". Journal of Applied Meteorology and Climatology.
 *
 * @param Ta - Air temperature in °C
 * @param RH - Relative humidity as percentage (0-100)
 * @returns Psychrometric wet bulb temperature in °C
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
 * Calculate dew point temperature from air temperature and relative humidity
 * @param Ta - Air temperature in °C
 * @param RH - Relative humidity as percentage (0-100)
 * @returns Dew point temperature in °C
 */
function calculateDewPoint(Ta: number, RH: number): number {
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * Ta) / (b + Ta) + Math.log(RH / 100);
  return (b * alpha) / (a - alpha);
}

/**
 * Calculate derivative of saturation vapor pressure with respect to temperature
 * @param T - Temperature in °C
 * @returns d(esat)/dT in Pa/K
 */
function calculateVaporPressureDerivative(T: number): number {
  const a = 17.625;
  const b = 243.04;
  const esat = calculateSaturationVaporPressure(T);
  return esat * a * b / Math.pow(b + T, 2);
}

/**
 * Calculate air properties at given temperature and pressure
 * @param TaK - Air temperature in Kelvin
 * @param P_Pa - Atmospheric pressure in Pa
 */
function calculateAirProperties(TaK: number, P_Pa: number): {
  rho: number;
  mu: number;
  k: number;
  Pr: number;
  Sc: number;
  D: number;
} {
  // Density using ideal gas law
  const rho = P_Pa / (CONSTANTS.R_DRY_AIR * TaK);

  // Dynamic viscosity using Sutherland's formula
  const T0 = 273.15;
  const mu0 = 1.73e-5; // Pa·s at 273.15 K
  const S = 110.4; // Sutherland constant for air
  const mu = mu0 * Math.pow(TaK / T0, 1.5) * (T0 + S) / (TaK + S);

  // Thermal conductivity
  const TaC = TaK - 273.15;
  const k = 0.02411 + 0.0000773 * TaC;

  // Prandtl number
  const cp = CONSTANTS.CP_AIR;
  const Pr = (cp * mu) / k;

  // Schmidt number (for air-water vapor)
  const Sc = 0.60;
  const D = mu / (rho * Sc);

  return { rho, mu, k, Pr, Sc, D };
}

/**
 * Calculate wind speed at 2m from wind speed at 10m using power law
 * @param u10m - Wind speed at 10m height (m/s)
 * @returns Wind speed at 2m height (m/s)
 */
function calculateWindAt2m(u10m: number): number {
  const p = 0.15; // Power law exponent for flat terrain
  const u2m = u10m * Math.pow(2 / 10, p);
  return Math.max(0.13, u2m); // Minimum per Kong et al.
}

/**
 * Calculate wick radiation components
 * @param Ta - Air temperature in °C
 * @param SRdown - Total shortwave radiation (W/m²)
 * @param directRad - Direct radiation (W/m²)
 * @param diffuseRad - Diffuse radiation (W/m²)
 * @param ea - Actual vapor pressure (Pa)
 * @param zenithDeg - Solar zenith angle in degrees
 */
function calculateWickRadiation(
  Ta: number,
  SRdown: number,
  directRad: number | undefined,
  diffuseRad: number | undefined,
  ea: number,
  zenithDeg: number
): { SRw: number; LRw: number } {
  if (SRdown <= 0) {
    // Nighttime - only longwave
    const TaK = Ta + 273.15;
    const eaHpa = ea / 100;
    const emissivityAtm = CONSTANTS.ATMOSPHERIC_EMISSIVITY_CONSTANT *
      Math.pow(eaHpa, CONSTANTS.ATMOSPHERIC_EMISSIVITY_EXPONENT);
    const LRdown = emissivityAtm * CONSTANTS.STEFAN_BOLTZMANN * Math.pow(TaK, 4);
    const LRup = CONSTANTS.STEFAN_BOLTZMANN * Math.pow(TaK, 4);
    const LRw = 0.5 * CONSTANTS.WICK_EMISSIVITY * (LRdown + LRup);
    return { SRw: 0, LRw };
  }

  const thetaRad = degToRad(zenithDeg);

  // Direct beam fraction
  let fdir: number;
  if (directRad !== undefined && diffuseRad !== undefined && (directRad + diffuseRad) > 0) {
    fdir = directRad / (directRad + diffuseRad);
  } else {
    const cosZ = Math.cos(thetaRad);
    fdir = Math.max(0.3, Math.min(0.85, 0.9 * cosZ));
  }

  // Reflected shortwave from ground
  const SRup = SRdown * RADIATION_CONSTANTS.SURFACE_ALBEDO;

  // Atmospheric longwave
  const TaK = Ta + 273.15;
  const eaHpa = ea / 100;
  const emissivityAtm = CONSTANTS.ATMOSPHERIC_EMISSIVITY_CONSTANT *
    Math.pow(eaHpa, CONSTANTS.ATMOSPHERIC_EMISSIVITY_EXPONENT);
  const LRdown = emissivityAtm * CONSTANTS.STEFAN_BOLTZMANN * Math.pow(TaK, 4);
  const LRup = CONSTANTS.STEFAN_BOLTZMANN * Math.pow(TaK, 4);

  // Shortwave on wick (Kong formula for cylindrical wick)
  // SRw = (1 - αw) * [(1 + d/(4L))(1-fdir)SR + (tan(θ)/π + d/(4L))fdir*SR + SRup]
  const dOverL = CONSTANTS.WICK_DIAMETER / (4 * CONSTANTS.WICK_LENGTH);

  let SRw: number;
  if (zenithDeg >= 85) {
    // Near/below horizon - treat all as diffuse
    SRw = (1 - CONSTANTS.WICK_ALBEDO) * ((1 + dOverL) * SRdown + SRup);
  } else {
    const tanTheta = Math.tan(thetaRad);
    SRw = (1 - CONSTANTS.WICK_ALBEDO) * (
      (1 + dOverL) * (1 - fdir) * SRdown +
      (tanTheta / Math.PI + dOverL) * fdir * SRdown +
      SRup
    );
  }

  // Longwave on wick
  const LRw = 0.5 * CONSTANTS.WICK_EMISSIVITY * (LRdown + LRup);

  return { SRw, LRw };
}

/**
 * Calculate heat transfer coefficients for wick
 */
function calculateWickHeatTransferCoefficients(
  Ta: number,
  Tw: number,
  P_Pa: number,
  u2m: number,
  airProps: ReturnType<typeof calculateAirProperties>
): {
  h_cw: number;
  h_rw: number;
  h_ew: number;
  beta: number;
} {
  const { rho, mu, k, Pr, Sc, D } = airProps;
  const TaK = Ta + 273.15;

  // Reynolds number for cylinder
  const Re_wick = (rho * u2m * CONSTANTS.WICK_DIAMETER) / mu;

  // Nusselt number (Morgan correlation for cylinder)
  const C_cylinder = 0.281;
  const m_cylinder = 0.6;
  const Nu_wick = C_cylinder * Math.pow(Re_wick, m_cylinder) * Math.pow(Pr, 1/3);

  // Convective heat transfer coefficient
  const h_cw = (k / CONSTANTS.WICK_DIAMETER) * Nu_wick;

  // Radiative heat transfer coefficient (linearized)
  const h_rw = 4 * CONSTANTS.STEFAN_BOLTZMANN * CONSTANTS.WICK_EMISSIVITY * Math.pow(TaK, 3);

  // Mass transfer coefficient
  const kx = (rho * D / (CONSTANTS.MOLECULAR_WEIGHT_AIR * CONSTANTS.WICK_DIAMETER)) *
    C_cylinder * Math.pow(Re_wick, m_cylinder) * Math.pow(Sc, 1/3);

  // Psychrometric coefficient (beta)
  const beta = kx * CONSTANTS.MOLECULAR_WEIGHT_WATER * CONSTANTS.LATENT_HEAT_VAPORIZATION / P_Pa;

  // Vapor pressure derivative at mean wick temperature
  const TwMean = (Tw + Ta) / 2;
  const desatDT = calculateVaporPressureDerivative(TwMean);

  // Evaporative heat transfer coefficient
  const h_ew = beta * desatDT;

  return { h_cw, h_rw, h_ew, beta };
}

/**
 * Calculate full Kong natural wet bulb temperature
 *
 * This implements the Kong et al. zero-iteration formula for natural wet bulb
 * temperature which includes radiation effects on the wick. This is the
 * physically correct Tnw for WBGT calculation.
 *
 * Reference: Kong, Q. & Huber, M. (2024). "Analytic estimates of wet-bulb
 * globe temperature" GeoHealth.
 *
 * @param Ta - Air temperature in °C
 * @param RH - Relative humidity (%)
 * @param SRw - Shortwave radiation on wick (W/m²)
 * @param LRw - Longwave radiation on wick (W/m²)
 * @param windSpeed - Wind speed at 10m (m/s)
 * @param P_hPa - Atmospheric pressure (hPa)
 * @returns Natural wet bulb temperature in °C
 */
function calculateKongNaturalWetBulb(
  Ta: number,
  RH: number,
  SRw: number,
  LRw: number,
  windSpeed: number,
  P_hPa: number = CONSTANTS.STANDARD_PRESSURE
): number {
  const TaK = Ta + 273.15;
  const P_Pa = P_hPa * 100;

  // Calculate Stull wet bulb as initial estimate (used for coefficients)
  const Tw = calculateWetBulbTemperature(Ta, RH);

  // Calculate actual vapor pressure
  const eSatTa = calculateSaturationVaporPressure(Ta);
  const ea = (RH / 100) * eSatTa;

  // Wind at 2m height
  const u10m = Math.max(1.0, windSpeed); // Minimum for numerical stability
  const u2m = calculateWindAt2m(u10m);

  // Air properties
  const airProps = calculateAirProperties(TaK, P_Pa);

  // Heat transfer coefficients
  const coeffs = calculateWickHeatTransferCoefficients(Ta, Tw, P_Pa, u2m, airProps);
  const { h_cw, h_rw, h_ew, beta } = coeffs;

  // Vapor Pressure Deficit term
  const VPD = beta * Math.max(eSatTa - ea, 0.0);

  // Radiation balance: SRw + LRw - σεTa⁴
  const radBalance = SRw + LRw - CONSTANTS.STEFAN_BOLTZMANN * CONSTANTS.WICK_EMISSIVITY * Math.pow(TaK, 4);

  // Total heat transfer coefficient with physics-based floor
  const denominator = Math.max(h_ew + h_cw + h_rw, CONSTANTS.MIN_HEAT_TRANSFER_COEFFICIENT);

  // Zero-iteration Kong formula: Tnw = Ta + (SRw + LRw - VPD - σεTa⁴) / (h_ew + h_cw + h_rw)
  let Tnw = Ta + (radBalance - VPD) / denominator;

  // Physical constraints:
  // 1. Natural wet bulb cannot exceed dry bulb temperature
  Tnw = Math.min(Tnw, Ta);

  // 2. Natural wet bulb cannot be below dew point (thermodynamic limit)
  const dewPoint = calculateDewPoint(Ta, Math.max(1, Math.min(99, RH)));
  Tnw = Math.max(Tnw, dewPoint);

  // 3. Absolute bounds for numerical safety
  Tnw = Math.max(Tnw, -50.0);
  Tnw = Math.min(Tnw, 60.0);

  return Tnw;
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
 * Calculate Julian Date from a JavaScript Date object
 *
 * Reference: NOAA Solar Calculator
 * https://gml.noaa.gov/grad/solcalc/calcdetails.html
 *
 * @param date - JavaScript Date object (in local time)
 * @returns Julian Date
 */
function calculateJulianDate(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // JavaScript months are 0-indexed
  const day = date.getDate();
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

  // Adjust for January/February
  let y = year;
  let m = month;
  if (month <= 2) {
    y = year - 1;
    m = month + 12;
  }

  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);

  const JD = Math.floor(365.25 * (y + 4716)) +
             Math.floor(30.6001 * (m + 1)) +
             day + hour / 24 + B - 1524.5;

  return JD;
}

/**
 * Convert degrees to radians
 */
function degToRad(deg: number): number {
  return deg * Math.PI / 180;
}

/**
 * Convert radians to degrees
 */
function radToDeg(rad: number): number {
  return rad * 180 / Math.PI;
}

/**
 * Calculate solar zenith angle using full NOAA Solar Calculator algorithm
 *
 * This implementation fixes critical bugs in simplified formulas:
 * 1. Missing timezone offset in True Solar Time calculation
 * 2. Hour angle sign error
 * 3. Missing Equation of Time correction
 *
 * Reference: NOAA Solar Calculator
 * https://gml.noaa.gov/grad/solcalc/calcdetails.html
 *
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @param timestamp - Local timestamp for calculation
 * @param utcOffset - UTC offset in hours (e.g., 10 for AEST, 11 for AEDT)
 * @returns Solar zenith angle in degrees (0° = overhead, 90° = horizon)
 */
function calculateSolarZenithAngleNOAA(
  lat: number,
  lon: number,
  timestamp: Date,
  utcOffset: number
): number {
  // Julian Date and Century from J2000.0
  const JD = calculateJulianDate(timestamp);
  const JD_utc = JD - utcOffset / 24; // Convert local to UTC
  const JC = (JD_utc - 2451545.0) / 36525.0;

  // Geometric Mean Longitude of Sun (degrees)
  const geomMeanLong = (280.46646 + JC * (36000.76983 + 0.0003032 * JC)) % 360;

  // Geometric Mean Anomaly of Sun (degrees)
  const geomMeanAnom = 357.52911 + JC * (35999.05029 - 0.0001537 * JC);

  // Eccentricity of Earth's Orbit
  const eccent = 0.016708634 - JC * (0.000042037 + 0.0000001267 * JC);

  // Sun's Equation of Center (degrees)
  const sunEqCtr = Math.sin(degToRad(geomMeanAnom)) * (1.914602 - JC * (0.004817 + 0.000014 * JC)) +
                   Math.sin(degToRad(2 * geomMeanAnom)) * (0.019993 - 0.000101 * JC) +
                   Math.sin(degToRad(3 * geomMeanAnom)) * 0.000289;

  // Sun's True Longitude (degrees)
  const sunTrueLong = geomMeanLong + sunEqCtr;

  // Apparent Longitude of Sun (degrees)
  const omega = 125.04 - 1934.136 * JC;
  const sunAppLong = sunTrueLong - 0.00569 - 0.00478 * Math.sin(degToRad(omega));

  // Mean Obliquity of Ecliptic (degrees)
  const meanObliq = 23 + (26 + (21.448 - JC * (46.815 + JC * (0.00059 - JC * 0.001813))) / 60) / 60;

  // Corrected Obliquity (degrees)
  const obliqCorr = meanObliq + 0.00256 * Math.cos(degToRad(omega));

  // Sun's Declination (radians)
  const declination = Math.asin(Math.sin(degToRad(obliqCorr)) * Math.sin(degToRad(sunAppLong)));

  // Variable y for Equation of Time
  const varY = Math.tan(degToRad(obliqCorr / 2)) ** 2;

  // Equation of Time (minutes)
  const eqOfTime = 4 * radToDeg(
    varY * Math.sin(2 * degToRad(geomMeanLong)) -
    2 * eccent * Math.sin(degToRad(geomMeanAnom)) +
    4 * eccent * varY * Math.sin(degToRad(geomMeanAnom)) * Math.cos(2 * degToRad(geomMeanLong)) -
    0.5 * varY ** 2 * Math.sin(4 * degToRad(geomMeanLong)) -
    1.25 * eccent ** 2 * Math.sin(2 * degToRad(geomMeanAnom))
  );

  // Clock hour (fractional)
  const clockHour = timestamp.getHours() + timestamp.getMinutes() / 60 + timestamp.getSeconds() / 3600;

  // True Solar Time (minutes)
  // CRITICAL: Include timezone offset correction (-60 * utcOffset)
  // Without this, UTC+11 locations would be off by 165° (11 hours × 15°/hour)
  let trueSolarTime = (clockHour * 60 + eqOfTime + 4 * lon - 60 * utcOffset) % 1440;
  if (trueSolarTime < 0) {
    trueSolarTime += 1440;
  }

  // Hour Angle (degrees)
  // CRITICAL: Correct formula is trueSolarTime/4 - 180
  // NOT 15 × (12 - localSolarTime) which inverts the sign
  let hourAngle: number;
  if (trueSolarTime / 4 < 180) {
    hourAngle = trueSolarTime / 4 + 180;
  } else {
    hourAngle = trueSolarTime / 4 - 180;
  }

  // Solar Zenith Angle (degrees)
  const latRad = degToRad(lat);
  const cosZenith = Math.sin(latRad) * Math.sin(declination) +
                    Math.cos(latRad) * Math.cos(declination) * Math.cos(degToRad(hourAngle));

  // Clamp to [-1, 1] to avoid NaN from acos
  const clampedCosZenith = Math.max(-1, Math.min(1, cosZenith));
  const zenithAngle = radToDeg(Math.acos(clampedCosZenith));

  return zenithAngle;
}

/**
 * Determine UTC offset based on timestamp and location
 *
 * For Australian Eastern time zones:
 * - AEST (Standard): UTC+10
 * - AEDT (Daylight Saving): UTC+11
 *
 * DST typically runs from first Sunday in October to first Sunday in April
 *
 * @param timestamp - Local timestamp
 * @param longitude - Longitude for rough timezone estimation
 * @returns UTC offset in hours
 */
function determineUTCOffset(timestamp: Date, longitude: number): number {
  // Use JavaScript's built-in timezone offset
  // getTimezoneOffset() returns minutes WEST of UTC, so we negate and divide by 60
  const jsOffset = -timestamp.getTimezoneOffset() / 60;

  // If JavaScript can determine the offset (running in correct timezone), use it
  // Otherwise, estimate from longitude for Australian Eastern (default to Sydney)
  if (jsOffset !== 0 || longitude < 140 || longitude > 160) {
    return jsOffset;
  }

  // Fallback for Australian Eastern timezone
  // Rough DST detection (October to April)
  const month = timestamp.getMonth(); // 0-indexed
  const isDST = month >= 9 || month <= 2; // Oct-Mar (approximate)
  return isDST ? 11 : 10;
}

/**
 * Calculate solar altitude angle using full NOAA algorithm
 *
 * Solar altitude = 90° - solar zenith angle
 *
 * @param latitude - Latitude in decimal degrees
 * @param longitude - Longitude in decimal degrees
 * @param timestamp - Time of calculation
 * @returns Solar altitude angle in radians
 */
function calculateSolarAltitude(
  latitude: number,
  longitude: number,
  timestamp: Date
): number {
  // Determine UTC offset for the timestamp
  const utcOffset = determineUTCOffset(timestamp, longitude);

  // Calculate solar zenith angle using full NOAA algorithm
  const zenithDegrees = calculateSolarZenithAngleNOAA(latitude, longitude, timestamp, utcOffset);

  // Convert zenith to altitude (altitude = 90° - zenith)
  const altitudeDegrees = 90 - zenithDegrees;

  // Convert to radians and ensure non-negative (sun below horizon = 0)
  return Math.max(0, degToRad(altitudeDegrees));
}

/**
 * Physical constants for radiation calculations
 */
const RADIATION_CONSTANTS = {
  /** Globe albedo (black globe absorbs most radiation) */
  GLOBE_ALBEDO: 0.05,
  /**
   * Surface albedo for urban running environments (dimensionless)
   *
   * Rationale: Based on comprehensive urban running surface analysis (Sydney Metro, 102 runs, 2 years)
   *
   * Surface distribution and albedo values:
   * - 35.3% Macquarie Park footpaths: 0.16 (asphalt/concrete mix)
   * - 17.6% Riverside paths: 0.17 (moist dark surfaces)
   * - 13.7% Suburban streets: 0.16 (asphalt)
   * - 12.7% Marsfield/Eastwood: 0.16 (asphalt)
   * - 5.9% Sydney Olympic Park: 0.25 (concrete)
   * - 3.9% Rhodes/Concord: 0.18 (mixed surfaces)
   * - 2.0% Pyrmont/CBD: 0.22 (urban concrete)
   * - 8.8% Other locations: 0.17-0.20 (mixed)
   *
   * Weighted average: 0.171, rounded to 0.18 for web application accuracy
   */
  SURFACE_ALBEDO: 0.18,
} as const;

/**
 * Calculate globe shortwave radiation using Kong & Huber 2024 formula
 *
 * SRg = (1/2)(1 - αg)[(1 - fdir)×SRdown + fdir×SRdown/(2×cos(θ)) + SRup]
 *
 * Where:
 * - αg = globe albedo (0.05 for black globe)
 * - fdir = direct beam fraction
 * - SRdown = total downwelling shortwave
 * - SRup = reflected shortwave from ground
 * - θ = solar zenith angle
 *
 * @param SRdown - Total shortwave radiation (W/m²)
 * @param directRad - Direct beam radiation (W/m²), optional
 * @param diffuseRad - Diffuse radiation (W/m²), optional
 * @param zenithDeg - Solar zenith angle in degrees
 * @returns Shortwave radiation absorbed by globe (W/m²)
 */
function calculateGlobeShortwave(
  SRdown: number,
  directRad: number | undefined,
  diffuseRad: number | undefined,
  zenithDeg: number
): number {
  if (SRdown <= 0) return 0;

  // Calculate direct beam fraction
  // If direct/diffuse available, use them; otherwise estimate from clearness
  let fdir: number;
  if (directRad !== undefined && diffuseRad !== undefined && (directRad + diffuseRad) > 0) {
    fdir = directRad / (directRad + diffuseRad);
  } else {
    // Estimate fdir from zenith angle (clear sky approximation)
    // Higher sun = more direct; lower sun = more diffuse
    const cosZ = Math.cos(zenithDeg * Math.PI / 180);
    fdir = Math.max(0.3, Math.min(0.85, 0.9 * cosZ));
  }

  // Reflected radiation from ground
  const SRup = SRdown * RADIATION_CONSTANTS.SURFACE_ALBEDO;

  // Absorption factor: (1/2)(1 - αg)
  const absorptionFactor = 0.5 * (1 - RADIATION_CONSTANTS.GLOBE_ALBEDO);

  // Handle sun near/below horizon
  if (zenithDeg >= 85) {
    // Treat all as diffuse (fdir → 0)
    return absorptionFactor * (SRdown + SRup);
  }

  // Normal case: Kong formula
  const cosTheta = Math.cos(zenithDeg * Math.PI / 180);
  const diffuseComponent = (1 - fdir) * SRdown;
  const directComponent = fdir * SRdown / (2 * Math.max(cosTheta, 0.01));

  return absorptionFactor * (diffuseComponent + directComponent + SRup);
}

/**
 * Calculate globe radiation components (shortwave and longwave)
 *
 * @param Ta - Air temperature in °C
 * @param SRdown - Total shortwave radiation (W/m²)
 * @param ea - Actual vapor pressure (Pa)
 * @param directRad - Direct radiation (W/m²)
 * @param diffuseRad - Diffuse radiation (W/m²)
 * @param zenithDeg - Solar zenith angle in degrees
 * @returns Object with SRg and LRg
 */
function calculateGlobeRadiation(
  Ta: number,
  SRdown: number,
  ea: number,
  directRad: number | undefined,
  diffuseRad: number | undefined,
  zenithDeg: number
): { SRg: number; LRg: number } {
  const TaK = Ta + 273.15;
  const eaHpa = ea / 100;

  // Atmospheric emissivity (Brutsaert formula)
  const emissivityAtm = CONSTANTS.ATMOSPHERIC_EMISSIVITY_CONSTANT *
    Math.pow(eaHpa, CONSTANTS.ATMOSPHERIC_EMISSIVITY_EXPONENT);

  // Longwave radiation components
  const LRdown = emissivityAtm * CONSTANTS.STEFAN_BOLTZMANN * Math.pow(TaK, 4);
  const LRup = CONSTANTS.STEFAN_BOLTZMANN * Math.pow(TaK, 4);

  // Longwave on globe: LRg = 0.5 * εg * (LRdown + LRup)
  const LRg = 0.5 * CONSTANTS.GLOBE_EMISSIVITY * (LRdown + LRup);

  // Shortwave on globe
  const SRg = calculateGlobeShortwave(SRdown, directRad, diffuseRad, zenithDeg);

  return { SRg, LRg };
}

/**
 * Calculate globe heat transfer coefficients
 *
 * @param Ta - Air temperature in °C
 * @param u2m - Wind speed at 2m (m/s)
 * @returns Object with h_cg and h_rg
 */
function calculateGlobeHeatTransferCoefficients(
  Ta: number,
  u2m: number
): { h_cg: number; h_rg: number } {
  const TaK = Ta + 273.15;
  const P_Pa = CONSTANTS.STANDARD_PRESSURE * 100;

  // Air properties
  const airProps = calculateAirProperties(TaK, P_Pa);
  const { rho, mu, k, Pr } = airProps;

  // Reynolds number for sphere
  const Re_globe = (rho * u2m * CONSTANTS.GLOBE_DIAMETER) / mu;

  // Nusselt number (Churchill correlation for sphere)
  const Nu_globe = 2.0 + 0.6 * Math.pow(Re_globe, 0.5) * Math.pow(Pr, 1/3);

  // Convective heat transfer coefficient
  const h_cg = (k / CONSTANTS.GLOBE_DIAMETER) * Nu_globe;

  // Radiative heat transfer coefficient (linearized)
  const h_rg = 4 * CONSTANTS.STEFAN_BOLTZMANN * CONSTANTS.GLOBE_EMISSIVITY * Math.pow(TaK, 3);

  return { h_cg, h_rg };
}

/**
 * Calculate black globe temperature using Kong & Huber zero-iteration method
 *
 * Implements the Kong et al. explicit formula:
 * Tg = Ta + (SRg + LRg - σεTa⁴) / (h_cg + h_rg)
 *
 * @param Ta - Air temperature in °C
 * @param SRg - Shortwave radiation on globe (W/m²)
 * @param LRg - Longwave radiation on globe (W/m²)
 * @param h_cg - Convective heat transfer coefficient (W/m²K)
 * @param h_rg - Radiative heat transfer coefficient (W/m²K)
 * @returns Black globe temperature in °C
 */
function calculateKongBlackGlobe(
  Ta: number,
  SRg: number,
  LRg: number,
  h_cg: number,
  h_rg: number
): number {
  const TaK = Ta + 273.15;

  // Numerator: shortwave + longwave - outgoing longwave at Ta
  const numerator = SRg + LRg - CONSTANTS.STEFAN_BOLTZMANN * CONSTANTS.GLOBE_EMISSIVITY * Math.pow(TaK, 4);

  // Denominator: total heat transfer coefficient with physics-based floor
  const denominator = Math.max(h_cg + h_rg, 5.0);

  // Zero-iteration formula
  const TgK = TaK + numerator / denominator;

  return TgK - 273.15;
}

/**
 * Calculate black globe temperature using full Kong & Huber 2024 method
 *
 * This solves the heat balance equation for a black globe thermometer using
 * the proper radiation geometry from Kong & Huber (2024) GeoHealth paper.
 *
 * @param Ta - Air temperature in °C
 * @param SR - Total solar radiation in W/m²
 * @param wind - Wind speed in m/s
 * @param latitude - Latitude in decimal degrees
 * @param longitude - Longitude in decimal degrees
 * @param timestamp - Timestamp for solar angle calculation
 * @param directRad - Direct beam radiation (W/m²), optional
 * @param diffuseRad - Diffuse radiation (W/m²), optional
 * @param RH - Relative humidity (%), optional for longwave calculation
 * @returns Black globe temperature in °C
 */
export function calculateGlobeTemperature(
  Ta: number,
  SR: number,
  wind: number,
  latitude: number = 0,
  longitude: number = 151.2093,
  timestamp: Date = new Date(),
  directRad?: number,
  diffuseRad?: number,
  RH: number = 50
): number {
  // Handle nighttime conditions (no solar radiation)
  if (SR <= 0) {
    // At night, still calculate with longwave radiation
    const TaK = Ta + 273.15;
    const eSatTa = calculateSaturationVaporPressure(Ta);
    const ea = (RH / 100) * eSatTa;

    const u2m = calculateWindAt2m(Math.max(1.0, wind));
    const { h_cg, h_rg } = calculateGlobeHeatTransferCoefficients(Ta, u2m);
    const { LRg } = calculateGlobeRadiation(Ta, 0, ea, 0, 0, 90);

    return calculateKongBlackGlobe(Ta, 0, LRg, h_cg, h_rg);
  }

  // Calculate solar zenith angle using full NOAA algorithm
  const utcOffset = determineUTCOffset(timestamp, longitude);
  const zenithDeg = calculateSolarZenithAngleNOAA(latitude, longitude, timestamp, utcOffset);

  // Calculate vapor pressure for longwave calculation
  const eSatTa = calculateSaturationVaporPressure(Ta);
  const ea = (RH / 100) * eSatTa;

  // Calculate wind at 2m
  const u2m = calculateWindAt2m(Math.max(1.0, wind));

  // Calculate heat transfer coefficients
  const { h_cg, h_rg } = calculateGlobeHeatTransferCoefficients(Ta, u2m);

  // Calculate radiation components
  const { SRg, LRg } = calculateGlobeRadiation(Ta, SR, ea, directRad, diffuseRad, zenithDeg);

  // Calculate globe temperature using Kong zero-iteration formula
  return calculateKongBlackGlobe(Ta, SRg, LRg, h_cg, h_rg);
}

/**
 * Calculate WBGT using the full Kong method
 *
 * The Kong method provides an explicit calculation of WBGT from standard
 * meteorological variables, suitable for forecasting applications.
 *
 * This implementation uses the full Kong natural wet bulb calculation which
 * includes radiation effects on the wick, matching the Kong & Huber (2024)
 * GeoHealth paper.
 *
 * WBGT = 0.7 * Tnw + 0.2 * Tg + 0.1 * Ta
 *
 * where:
 * - Tnw = Natural wet bulb temperature (with radiation effects)
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
    directRadiation,
    diffuseRadiation,
    latitude,
    longitude,
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

  // Calculate solar zenith angle
  const utcOffset = determineUTCOffset(timestamp, longitude);
  const zenithDeg = calculateSolarZenithAngleNOAA(latitude, longitude, timestamp, utcOffset);

  // Handle sun below horizon
  const isSunAboveHorizon = zenithDeg <= 90;
  const SRdown = isSunAboveHorizon ? solarRadiation : 0;
  const directRad = isSunAboveHorizon ? directRadiation : 0;
  const diffuseRad = isSunAboveHorizon ? diffuseRadiation : 0;

  // Calculate actual vapor pressure for wick radiation
  const eSatTa = calculateSaturationVaporPressure(temperature);
  const ea = (relativeHumidity / 100) * eSatTa;

  // Calculate wick radiation components
  const { SRw, LRw } = calculateWickRadiation(
    temperature,
    SRdown,
    directRad,
    diffuseRad,
    ea,
    zenithDeg
  );

  // Calculate full Kong natural wet bulb temperature
  const wetBulbTemp = calculateKongNaturalWetBulb(
    temperature,
    relativeHumidity,
    SRw,
    LRw,
    windSpeed
  );

  // Calculate globe temperature
  const globeTemp = calculateGlobeTemperature(
    temperature,
    SRdown,
    windSpeed,
    latitude,
    longitude,
    timestamp,
    directRad,
    diffuseRad,
    relativeHumidity
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
