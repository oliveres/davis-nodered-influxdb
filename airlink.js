// ============================================================
// Davis AirLink → InfluxDB Line Protocol Converter for NodeRED
// https://github.com/oliveres/davis-nodered-influxdb
// ============================================================

// CONFIGURATION
const CONFIG = {
    measurement: 'air_quality',
    tags: {
        source: 'davis_airlink',
        location: 'outside',
        friendly_name: 'Davis AirLink'
        // sensor_id is added dynamically from device data
    }
};

// ============================================================
// FIELD SCHEMA DEFINITION
// Each field: { type: 'float'|'int', source?: string, convert?: function }
// - type: InfluxDB data type ('float' = no suffix, 'int' = 'i' suffix)
// - source: field name in raw API data (defaults to key name if omitted)
// - convert: conversion function (value passed through if omitted)
// ============================================================

// Unit conversion functions
const fahrenheitToCelsius = (f) => f != null ? +((f - 32) * 5 / 9).toFixed(1) : null;

const FIELD_SCHEMA = {
    // Meteorological values (converted from °F to °C)
    temp:       { type: 'float', convert: fahrenheitToCelsius },
    hum:        { type: 'float' },  // %RH - no conversion needed
    dew_point:  { type: 'float', convert: fahrenheitToCelsius },
    heat_index: { type: 'float', convert: fahrenheitToCelsius },
    wet_bulb:   { type: 'float', convert: fahrenheitToCelsius },
    
    // PM values - averages (float, µg/m³)
    pm_1:                  { type: 'float' },
    pm_2p5:                { type: 'float' },
    pm_2p5_last_1_hour:    { type: 'float' },
    pm_2p5_last_3_hours:   { type: 'float' },
    pm_2p5_last_24_hours:  { type: 'float' },
    pm_2p5_nowcast:        { type: 'float' },
    pm_10:                 { type: 'float' },
    pm_10_last_1_hour:     { type: 'float' },
    pm_10_last_3_hours:    { type: 'float' },
    pm_10_last_24_hours:   { type: 'float' },
    pm_10_nowcast:         { type: 'float' },
    
    // PM values - last reading (integer, µg/m³)
    pm_1_last:   { type: 'int' },
    pm_2p5_last: { type: 'int' },
    pm_10_last:  { type: 'int' },
    
    // Data availability percentage (integer, 0-100%)
    pct_pm_data_last_1_hour:   { type: 'int' },
    pct_pm_data_last_3_hours:  { type: 'int' },
    pct_pm_data_last_24_hours: { type: 'int' },
    pct_pm_data_nowcast:       { type: 'int' }
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
if (!payload?.data?.ts || !payload?.data?.conditions?.[0] || 
    payload.data.conditions[0].data_structure_type !== 6) {
    node.warn("Invalid AirLink JSON structure - skipped");
    return null;
}

const data = payload.data;
const air = data.conditions[0];
const timestamp = data.ts * 1000000000; // Convert to nanoseconds for InfluxDB

// Line protocol escape functions
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

// Build tags
const tags = { 
    ...CONFIG.tags, 
    sensor_id: data.did || 'unknown' 
};

// Build fields from schema
const fields = buildFields(air, FIELD_SCHEMA);

if (Object.keys(fields).length === 0) {
    node.warn("No valid data to write");
    node.status({ fill: "red", shape: "ring", text: "No data" });
    return null;
}

// Output
msg.payload = toLineProtocol(CONFIG.measurement, tags, fields, timestamp);
node.status({ fill: "green", shape: "dot", text: "AirLink OK" });
return msg;
