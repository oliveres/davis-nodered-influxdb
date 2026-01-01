// =====================================================================
// Davis WeatherLink Live → InfluxDB Line Protocol Converter for NodeRED
// https://github.com/oliveres/davis-nodered-influxdb
// =====================================================================

// CONFIGURATION
const CONFIG = {
    // Rain collector size in mm per tip
    // Values: 0.2 (rain_size=2), 0.1 (rain_size=3), 0.254 (rain_size=1, 0.01"), 0.0254 (rain_size=4, 0.001")
    rainCupSizeMm: 0.2,
    
    outdoor: {
        measurement: 'outdoor_conditions',
        tags: {
            source: 'davis',
            location: 'outside',
            friendly_name: 'Davis Outdoor ISS'
        }
    },
    indoor: {
        measurement: 'indoor_conditions',
        tags: {
            source: 'davis',
            location: 'indoor',
            friendly_name: 'Davis Indoor Console'
        }
    },
    barometer: {
        measurement: 'barometer',
        tags: {
            source: 'davis',
            location: 'indoor',
            friendly_name: 'Davis Barometer'
        }
    }
};

// ============================================================
// UNIT CONVERSION FUNCTIONS
// ============================================================

const fahrenheitToCelsius = (f) => f != null ? +((f - 32) * 5 / 9).toFixed(1) : null;
const inHgToHPa = (inHg) => inHg != null ? +(inHg * 33.8639).toFixed(1) : null;
const inHgToHPaTrend = (inHg) => inHg != null ? +(inHg * 33.8639).toFixed(3) : null;
const mphToMs = (mph) => mph != null ? +(mph * 0.44704).toFixed(2) : null;
const tipsToMm = (tips) => tips != null ? +(tips * CONFIG.rainCupSizeMm).toFixed(1) : null;

// ============================================================
// FIELD SCHEMA DEFINITIONS
// Each field: { type: 'float'|'int', source?: string, convert?: function }
// - type: InfluxDB data type ('float' = no suffix, 'int' = 'i' suffix)
// - source: field name in raw API data (defaults to key name if omitted)
// - convert: conversion function (value passed through if omitted)
// ============================================================

const OUTDOOR_SCHEMA = {
    // Temperature values (converted from °F to °C)
    temp:       { type: 'float', convert: fahrenheitToCelsius },
    hum:        { type: 'float' },  // %RH
    dew_point:  { type: 'float', convert: fahrenheitToCelsius },
    wet_bulb:   { type: 'float', convert: fahrenheitToCelsius },
    heat_index: { type: 'float', convert: fahrenheitToCelsius },
    wind_chill: { type: 'float', convert: fahrenheitToCelsius },
    thw_index:  { type: 'float', convert: fahrenheitToCelsius },
    thsw_index: { type: 'float', convert: fahrenheitToCelsius },
    
    // Wind speed (converted from mph to m/s)
    wind_speed_last:            { type: 'float', convert: mphToMs },
    wind_speed_avg_last_1_min:  { type: 'float', convert: mphToMs },
    wind_speed_avg_last_2_min:  { type: 'float', convert: mphToMs },
    wind_speed_hi_last_2_min:   { type: 'float', convert: mphToMs },
    wind_speed_avg_last_10_min: { type: 'float', convert: mphToMs },
    wind_speed_hi_last_10_min:  { type: 'float', convert: mphToMs },
    
    // Wind direction (degrees 0-360, integer)
    wind_dir_last:                     { type: 'int' },
    wind_dir_scalar_avg_last_1_min:    { type: 'int' },
    wind_dir_scalar_avg_last_2_min:    { type: 'int' },
    wind_dir_at_hi_speed_last_2_min:   { type: 'int' },
    wind_dir_scalar_avg_last_10_min:   { type: 'int' },
    wind_dir_at_hi_speed_last_10_min:  { type: 'int' },
    
    // Rainfall (converted from tips/counts to mm)
    rain_rate_last:           { type: 'float', convert: tipsToMm },
    rain_rate_hi:             { type: 'float', convert: tipsToMm },
    rainfall_last_15_min:     { type: 'float', convert: tipsToMm },
    rain_rate_hi_last_15_min: { type: 'float', convert: tipsToMm },
    rainfall_last_60_min:     { type: 'float', convert: tipsToMm },
    rainfall_last_24_hr:      { type: 'float', convert: tipsToMm },
    rainfall_daily:           { type: 'float', convert: tipsToMm },
    rainfall_monthly:         { type: 'float', convert: tipsToMm },
    rainfall_year:            { type: 'float', convert: tipsToMm },
    rain_storm:               { type: 'float', convert: tipsToMm },
    rain_storm_last:          { type: 'float', convert: tipsToMm },
    
    // Solar radiation (W/m²) and UV index
    solar_rad: { type: 'int' },
    uv_index:  { type: 'float' }
};

const INDOOR_SCHEMA = {
    temp_in:       { type: 'float', convert: fahrenheitToCelsius },
    hum_in:        { type: 'float' },
    dew_point_in:  { type: 'float', convert: fahrenheitToCelsius },
    heat_index_in: { type: 'float', convert: fahrenheitToCelsius }
};

const BAROMETER_SCHEMA = {
    bar_sea_level: { type: 'float', convert: inHgToHPa },
    bar_absolute:  { type: 'float', convert: inHgToHPa },
    bar_trend:     { type: 'float', convert: inHgToHPaTrend }
};

// ============================================================
// PROCESSING LOGIC
// ============================================================

// Parse input
if (typeof msg.payload === 'string') {
    try {
        msg.payload = JSON.parse(msg.payload);
    } catch (e) {
        node.error("JSON parsing error: " + e.message);
        return null;
    }
}

const payload = msg.payload;
if (!payload?.data?.ts || !payload?.data?.conditions) {
    node.warn("Invalid payload structure");
    return null;
}

const data = payload.data;
const timestamp = data.ts * 1000000000; // Convert to nanoseconds

// Line protocol escape function
const escapeTagValue = (v) => String(v)
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/=/g, '\\=')
    .replace(/ /g, '\\ ');

// Build fields from schema
function buildFields(source, schema) {
    const fields = {};
    for (const [fieldName, config] of Object.entries(schema)) {
        const sourceKey = config.source || fieldName;
        let value = source[sourceKey];
        
        if (value == null) continue;
        
        if (config.convert) {
            value = config.convert(value);
        }
        
        if (value == null || Number.isNaN(value)) continue;
        
        fields[fieldName] = { value, type: config.type };
    }
    return fields;
}

// Generate line protocol string
function toLineProtocol(measurement, tags, fields, ts) {
    const tagStr = Object.entries(tags)
        .filter(([, v]) => v != null)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${escapeTagValue(v)}`)
        .join(',');
    
    const fieldStr = Object.entries(fields)
        .map(([k, { value, type }]) => {
            if (type === 'int') {
                return `${k}=${Math.floor(value)}i`;
            }
            return `${k}=${value}`;
        })
        .join(',');
    
    if (!fieldStr) return null;
    return `${measurement},${tagStr} ${fieldStr} ${ts}`;
}

// Find data blocks by structure type
const outdoor = data.conditions.find(c => c.data_structure_type === 1 && c.txid === 1);
const indoor = data.conditions.find(c => c.data_structure_type === 4);
const bar = data.conditions.find(c => c.data_structure_type === 3);

const lines = [];

// Outdoor conditions
if (outdoor) {
    const tags = { ...CONFIG.outdoor.tags, sensor_id: data.did || 'unknown' };
    const fields = buildFields(outdoor, OUTDOOR_SCHEMA);
    const line = toLineProtocol(CONFIG.outdoor.measurement, tags, fields, timestamp);
    if (line) lines.push(line);
}

// Indoor conditions
if (indoor) {
    const fields = buildFields(indoor, INDOOR_SCHEMA);
    const line = toLineProtocol(CONFIG.indoor.measurement, CONFIG.indoor.tags, fields, timestamp);
    if (line) lines.push(line);
}

// Barometer
if (bar) {
    const fields = buildFields(bar, BAROMETER_SCHEMA);
    const line = toLineProtocol(CONFIG.barometer.measurement, CONFIG.barometer.tags, fields, timestamp);
    if (line) lines.push(line);
}

if (lines.length === 0) {
    node.warn("No valid data points");
    return null;
}

msg.payload = lines.join("\n");
node.status({ fill: "green", shape: "dot", text: `${lines.length} points` });
return msg;
