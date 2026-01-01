# Davis WeatherLink Live & AirLink to InfluxDB Converter for Node-RED

Node-RED function nodes for converting Davis Instruments WeatherLink Live and AirLink local API JSON responses to InfluxDB Line Protocol.

## Features

- 🌡️ **WeatherLink Live** - Outdoor conditions, indoor conditions, and barometer data
- 🌫️ **AirLink** - Air quality and PM2.5/PM10 sensor data
- 📊 **InfluxDB Line Protocol** - Direct output ready for InfluxDB v2/v3
- 🔧 **Configurable** - Rain cup size, measurement names, tags
- 📐 **Unit Conversion** - Automatic conversion from imperial to metric units
- ✅ **Strict Typing** - Explicit field types (int/float) for InfluxDB compatibility

## Requirements

- [Node-RED](https://nodered.org/)
- Davis WeatherLink Live or AirLink device on local network
- InfluxDB v2 or v3

## Installation

1. Copy the appropriate function node code into a Node-RED Function node
2. Configure the `CONFIG` section at the top of each script
3. Connect to your Davis device via HTTP Request node
4. Send output to InfluxDB using your preferred method (HTTP Request, InfluxDB node, etc.)

## Node-RED Flow Example

```
[HTTP Request] → [Function Node] → [InfluxDB Write]
     ↑
  Davis API
```

### WeatherLink Live API Endpoint
```
http://<device-ip>/v1/current_conditions
```

### AirLink API Endpoint
```
http://<device-ip>/v1/current_conditions
```

## Configuration

### WeatherLink Live

```javascript
const CONFIG = {
    // Transmitter ID for outdoor ISS (check your WeatherLink Live config)
    // Most common setup: txid=1 is main ISS with all sensors
    outdoorTxId: 1,     

    // Rain collector size in mm per tip
    // Values: 0.2 (rain_size=2), 0.1 (rain_size=3), 
    //         0.254 (rain_size=1, 0.01"), 0.0254 (rain_size=4, 0.001")
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
        tags: { ... }
    },
    barometer: {
        measurement: 'barometer',
        tags: { ... }
    }
};
```

### AirLink

```javascript
const CONFIG = {
    measurement: 'air_quality',
    tags: {
        source: 'davis_airlink',
        location: 'outside',
        friendly_name: 'Davis AirLink'
    }
};
```

## Multi-Transmitter Setup

Davis WeatherLink Live supports multiple transmitters (up to 8). By default, 
this converter uses `txid=1` for outdoor conditions.

If your setup is different (e.g., separate anemometer on txid=2, or main ISS 
on different txid), modify the `outdoorTxId` in CONFIG section.

Common configurations:
- Single ISS: `outdoorTxId: 1` (default)
- Main ISS on txid 2: `outdoorTxId: 2`

For complex setups with multiple sensor types across transmitters, you may 
need to customize the code to merge data from multiple txids.

## Unit Conversions

| Value | API Unit | Converted Unit |
|-------|----------|----------------|
| Temperature | °F | °C |
| Wind Speed | mph | m/s |
| Barometric Pressure | inHg | hPa |
| Rainfall | tips (counts) | mm |
| Humidity | %RH | %RH (no conversion) |
| PM values | µg/m³ | µg/m³ (no conversion) |
| Solar Radiation | W/m² | W/m² (no conversion) |

## Data Schema

### WeatherLink Live - Outdoor Conditions

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `temp` | float | °C | Temperature |
| `hum` | float | %RH | Relative humidity |
| `dew_point` | float | °C | Dew point temperature |
| `wet_bulb` | float | °C | Wet bulb temperature |
| `heat_index` | float | °C | Heat index |
| `wind_chill` | float | °C | Wind chill |
| `thw_index` | float | °C | THW index |
| `thsw_index` | float | °C | THSW index |
| `wind_speed_last` | float | m/s | Last wind speed |
| `wind_speed_avg_last_1_min` | float | m/s | 1-min average wind speed |
| `wind_speed_avg_last_2_min` | float | m/s | 2-min average wind speed |
| `wind_speed_hi_last_2_min` | float | m/s | 2-min high wind speed |
| `wind_speed_avg_last_10_min` | float | m/s | 10-min average wind speed |
| `wind_speed_hi_last_10_min` | float | m/s | 10-min high wind speed |
| `wind_dir_last` | int | ° | Last wind direction |
| `wind_dir_scalar_avg_last_1_min` | int | ° | 1-min scalar avg direction |
| `wind_dir_scalar_avg_last_2_min` | int | ° | 2-min scalar avg direction |
| `wind_dir_at_hi_speed_last_2_min` | int | ° | Direction at 2-min high speed |
| `wind_dir_scalar_avg_last_10_min` | int | ° | 10-min scalar avg direction |
| `wind_dir_at_hi_speed_last_10_min` | int | ° | Direction at 10-min high speed |
| `rain_rate_last` | float | mm | Last rain rate |
| `rain_rate_hi` | float | mm | High rain rate |
| `rainfall_last_15_min` | float | mm | 15-min rainfall |
| `rain_rate_hi_last_15_min` | float | mm | 15-min high rain rate |
| `rainfall_last_60_min` | float | mm | 60-min rainfall |
| `rainfall_last_24_hr` | float | mm | 24-hr rainfall |
| `rainfall_daily` | float | mm | Daily rainfall |
| `rainfall_monthly` | float | mm | Monthly rainfall |
| `rainfall_year` | float | mm | Yearly rainfall |
| `rain_storm` | float | mm | Current storm rainfall |
| `rain_storm_last` | float | mm | Last storm rainfall |
| `solar_rad` | int | W/m² | Solar radiation |
| `uv_index` | float | index | UV index |

### WeatherLink Live - Indoor Conditions

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `temp_in` | float | °C | Indoor temperature |
| `hum_in` | float | %RH | Indoor humidity |
| `dew_point_in` | float | °C | Indoor dew point |
| `heat_index_in` | float | °C | Indoor heat index |

### WeatherLink Live - Barometer

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `bar_sea_level` | float | hPa | Sea level pressure |
| `bar_absolute` | float | hPa | Absolute pressure |
| `bar_trend` | float | hPa | 3-hour pressure trend |

### AirLink - Air Quality

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `temp` | float | °C | Temperature |
| `hum` | float | %RH | Relative humidity |
| `dew_point` | float | °C | Dew point |
| `heat_index` | float | °C | Heat index |
| `wet_bulb` | float | °C | Wet bulb temperature |
| `pm_1` | float | µg/m³ | PM1.0 (1-min avg) |
| `pm_2p5` | float | µg/m³ | PM2.5 (1-min avg) |
| `pm_10` | float | µg/m³ | PM10 (1-min avg) |
| `pm_1_last` | int | µg/m³ | PM1.0 (last reading) |
| `pm_2p5_last` | int | µg/m³ | PM2.5 (last reading) |
| `pm_10_last` | int | µg/m³ | PM10 (last reading) |
| `pm_2p5_last_1_hour` | float | µg/m³ | PM2.5 (1-hr avg) |
| `pm_2p5_last_3_hours` | float | µg/m³ | PM2.5 (3-hr avg) |
| `pm_2p5_last_24_hours` | float | µg/m³ | PM2.5 (24-hr avg) |
| `pm_2p5_nowcast` | float | µg/m³ | PM2.5 (NowCast) |
| `pm_10_last_1_hour` | float | µg/m³ | PM10 (1-hr avg) |
| `pm_10_last_3_hours` | float | µg/m³ | PM10 (3-hr avg) |
| `pm_10_last_24_hours` | float | µg/m³ | PM10 (24-hr avg) |
| `pm_10_nowcast` | float | µg/m³ | PM10 (NowCast) |
| `pct_pm_data_last_1_hour` | int | % | Data availability (1-hr) |
| `pct_pm_data_last_3_hours` | int | % | Data availability (3-hr) |
| `pct_pm_data_last_24_hours` | int | % | Data availability (24-hr) |
| `pct_pm_data_nowcast` | int | % | Data availability (NowCast) |

## Output Example

### WeatherLink Live
```
outdoor_conditions,friendly_name=Davis\ Outdoor\ ISS,location=outside,sensor_id=001D0A714F02,source=davis temp=0.5,hum=75.5,dew_point=-3.3,wind_speed_last=2.68,wind_dir_last=180i,solar_rad=46i,uv_index=0.3 1767276499000000000
indoor_conditions,friendly_name=Davis\ Indoor\ Console,location=indoor,source=davis temp_in=22.4,hum_in=35.9,dew_point_in=6.6 1767276499000000000
barometer,friendly_name=Davis\ Barometer,location=indoor,source=davis bar_sea_level=1003.2,bar_absolute=977.2,bar_trend=-2.778 1767276499000000000
```

### AirLink
```
air_quality,friendly_name=Davis\ AirLink,location=outside,sensor_id=001D0A100805,source=davis_airlink temp=1.3,hum=73.2,pm_2p5=11.1,pm_2p5_last=10i,pm_10=11.43,pm_10_last=10i,pct_pm_data_last_1_hour=100i 1767277963000000000
```

## InfluxDB Integration

### Using HTTP Request Node (InfluxDB v2/v3)

```
POST https://your-influxdb:8086/api/v2/write?bucket=weather&precision=ns
Authorization: Token your-token
Content-Type: text/plain

[line protocol output]
```

### Using InfluxDB Node

Connect the function node output directly to an InfluxDB node configured for line protocol input.

## Troubleshooting

### "parsing for line protocol failed"

This usually means a field type mismatch. InfluxDB enforces strict typing - once a field is created as float, you cannot write integer values to it (and vice versa). 

Check your existing data types:
```sql
SHOW FIELD KEYS FROM outdoor_conditions
```

### Missing data

- Check if your Davis device is returning `null` values
- Verify network connectivity to the device
- The converter skips fields with `null` or `NaN` values

## References

- [WeatherLink Live Local API Documentation](https://weatherlink.github.io/weatherlink-live-local-api/)
- [AirLink Local API Documentation](https://weatherlink.github.io/airlink-local-api/)
- [InfluxDB Line Protocol](https://docs.influxdata.com/influxdb/latest/reference/syntax/line-protocol/)

## License

MIT License - see [LICENSE](LICENSE) file.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Credits

Developed by oliveres.
