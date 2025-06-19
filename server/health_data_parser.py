from typing import List, Dict, Any, Optional
import os
from datetime import datetime, timedelta
import xml.etree.ElementTree as ET
from pathlib import Path
import gzip
import json
from collections import defaultdict
from dataclasses import dataclass
from enum import Enum

class RecordType(str, Enum):
    STEP_COUNT = 'HKQuantityTypeIdentifierStepCount'
    DISTANCE = 'HKQuantityTypeIdentifierDistanceWalkingRunning'
    ACTIVE_ENERGY = 'HKQuantityTypeIdentifierActiveEnergyBurned'

@dataclass
class ActivityRecord:
    date: str
    steps: int = 0
    distance: float = 0.0  # in km
    active_energy_burned: float = 0.0  # in kcal
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'date': self.date,
            'steps': self.steps,
            'distance': round(self.distance, 2),
            'activeEnergyBurned': round(self.active_energy_burned, 2)
        }

class HealthDataParser:
    def __init__(self, export_file_path: str):
        self.export_file_path = Path(export_file_path)
        self.ns = {'ns': 'http://www.apple.com/Health/'}
    
    def get_sleep_data(self, days: int = 30) -> List[Dict[str, Any]]:
        """
        Parse sleep data from Apple Health export.
        
        Args:
            days: Number of days of data to return
            
        Returns:
            List of dictionaries containing sleep data by date
        """
        # Set up logging to file with absolute path
        log_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sleep_parser.log')
        print(f"Writing logs to: {log_file}")
        try:
            with open(log_file, 'w') as f:
                f.write(f"=== Sleep Parser Log - {datetime.now()} ===\n\n")
        except Exception as e:
            print(f"Error creating log file: {e}")
        
        def log(msg):
            print(msg)
            with open(log_file, 'a') as f:
                f.write(f"{msg}\n")
        
        default_return = []
        
        # Set up date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        log(f"Getting sleep data from {start_date.date()} to {end_date.date()}")
        
        try:
            # Check if export file exists
            if not os.path.exists(self.export_file_path):
                log(f"Export file not found at {self.export_file_path}")
                return default_return
                
            file_size = os.path.getsize(self.export_file_path)
            log(f"Export file size: {file_size} bytes")
            
            if file_size == 0:
                log("Export file is empty")
                return default_return
                
            # Parse the XML file
            log("Parsing XML file...")
            try:
                # First, let's check the first few lines of the file to verify it's XML
                with open(self.export_file_path, 'r', encoding='utf-8') as f:
                    first_lines = [next(f) for _ in range(5)]
                    log("First 5 lines of export file:")
                    for line in first_lines:
                        log(f"  {line.strip()}")
                
                # Now parse the full file
                tree = ET.parse(self.export_file_path)
                root = tree.getroot()
                log("Successfully parsed XML file")
                
                # Log the root element and its attributes
                log(f"Root element: {root.tag}")
                log(f"Root attributes: {root.attrib}")
                
                # Count total records
                all_records = list(root.findall('.//Record'))
                log(f"Total records in export: {len(all_records)}")
                
                # Count records by type
                record_types = {}
                for record in all_records:
                    record_type = record.get('type')
                    record_types[record_type] = record_types.get(record_type, 0) + 1
                
                log("Record types and counts:")
                for rtype, count in sorted(record_types.items()):
                    log(f"  {rtype}: {count}")
                
                # Look for sleep records using the correct XPath syntax
                sleep_records = root.findall(".//*[@type='HKCategoryTypeIdentifierSleepAnalysis']")
                log(f"Found {len(sleep_records)} sleep records")
                
                # Print first few sleep records if any
                for i, record in enumerate(sleep_records[:5]):
                    log(f"\nSleep record {i+1}:")
                    log(f"  Type: {record.get('type')}")
                    log(f"  Value: {record.get('value')}")
                    log(f"  Start: {record.get('startDate')}")
                    log(f"  End: {record.get('endDate')}")
                    log(f"  Source: {record.get('sourceName')}")
                    
                if not sleep_records:
                    log("No sleep records found. Here are some record types that exist:")
                    for i, rtype in enumerate(sorted(record_types.keys())):
                        if i < 20:  # Only show first 20 types to avoid too much output
                            log(f"  - {rtype}")
                        
            except Exception as e:
                error_msg = f"Error parsing XML file: {str(e)}"
                log(error_msg)
                import traceback
                tb = traceback.format_exc()
                log(tb)
                return default_return
            
            # Dictionary to store sleep data by date
            sleep_data = {}
            
            # First, find all sleep records
            sleep_records = root.findall(".//Record[@type='HKCategoryTypeIdentifierSleepAnalysis']")
            log(f"Found {len(sleep_records)} sleep records in the export file")
            
            if not sleep_records:
                log("Warning: No sleep records found in the export file")
                return []
                
            # Find the date range of sleep data
            all_dates = set()
            for record in sleep_records:
                start_date_str = record.get('startDate')
                if start_date_str:
                    # Extract just the date part (YYYY-MM-DD)
                    date_str = start_date_str.split()[0]
                    all_dates.add(date_str)
            
            log(f"Sleep data found for {len(all_dates)} unique dates")
            
            if not all_dates:
                log("No valid sleep dates found in records")
                return []
                
            # Sort dates and get the range
            sorted_dates = sorted(all_dates)
            start_date = datetime.strptime(sorted_dates[0], "%Y-%m-%d")
            end_date = datetime.strptime(sorted_dates[-1], "%Y-%m-%d")
            delta_days = (end_date - start_date).days + 1  # +1 to include end date
            
            log(f"Sleep data spans {delta_days} days from {sorted_dates[0]} to {sorted_dates[-1]}")
            
            # Initialize sleep_data with all dates in range
            for i in range(delta_days + 1):
                current_date = start_date + timedelta(days=i)
                date_str = current_date.strftime("%Y-%m-%d")
                sleep_data[date_str] = {
                    "date": date_str,
                    "inBed": 0,
                    "asleep": 0,
                    "deep": 0,
                    "rem": 0,
                    "light": 0,
                    "awake": 0
                }
                
            processed_records = 0
            for record in sleep_records:
                try:
                    processed_records += 1
                    # Get record date and times
                    start_date_str = record.get('startDate')
                    end_date_str = record.get('endDate')
                    
                    if not start_date_str or not end_date_str:
                        log("Skipping record: Missing start or end date")
                        continue
                    
                    # Parse dates with timezone information
                    start_datetime = datetime.strptime(start_date_str, "%Y-%m-%d %H:%M:%S %z")
                    end_datetime = datetime.strptime(end_date_str, "%Y-%m-%d %H:%M:%S %z")
                    
                    # Calculate duration in minutes
                    duration = (end_datetime - start_datetime).total_seconds() / 60
                    
                    # Skip if duration is zero or negative
                    if duration <= 0:
                        continue
                    
                    # Get the date string for this record
                    date_str = start_datetime.strftime("%Y-%m-%d")
                    
                    # Ensure this date is in our sleep_data
                    if date_str not in sleep_data:
                        log(f"Date {date_str} not in expected range, adding it")
                        sleep_data[date_str] = {
                            "date": date_str,
                            "inBed": 0,
                            "asleep": 0,
                            "deep": 0,
                            "rem": 0,
                            "light": 0,
                            "awake": 0
                        }
                    
                    # Get sleep stage
                    sleep_value = record.get('value', '')
                    
                    # Debug log for the first few records
                    if len(sleep_data[date_str].get("debug_records", [])) < 3:
                        if "debug_records" not in sleep_data[date_str]:
                            sleep_data[date_str]["debug_records"] = []
                        sleep_data[date_str]["debug_records"].append({
                            "start": start_date_str,
                            "end": end_date_str,
                            "value": sleep_value,
                            "duration": duration
                        })
                    
                    # Update sleep data based on sleep stage
                    if 'InBed' in sleep_value:
                        sleep_data[date_str]["inBed"] += duration
                    elif 'AsleepCore' in sleep_value or 'Core' in sleep_value:
                        sleep_data[date_str]["asleep"] += duration
                        sleep_data[date_str]["light"] += duration
                    elif 'AsleepDeep' in sleep_value or 'Deep' in sleep_value:
                        sleep_data[date_str]["asleep"] += duration
                        sleep_data[date_str]["deep"] += duration
                    elif 'AsleepREM' in sleep_value or 'REM' in sleep_value:
                        sleep_data[date_str]["asleep"] += duration
                        sleep_data[date_str]["rem"] += duration
                    elif 'Asleep' in sleep_value:  # Fallback for any other asleep state
                        sleep_data[date_str]["asleep"] += duration
                        sleep_data[date_str]["light"] += duration  # Default to light sleep
                    elif 'Awake' in sleep_value:
                        sleep_data[date_str]["awake"] += duration
                
                except Exception as e:
                    log(f"Error processing record: {e}")
                    import traceback
                    log(traceback.format_exc())
                    continue
            
            # Convert to list, remove debug info, and filter out dates with no sleep data
            result = []
            for date_str, data in sleep_data.items():
                # Skip debug records before adding to result
                if "debug_records" in data:
                    log(f"\nDebug records for {date_str}:")
                    for i, rec in enumerate(data["debug_records"][:3]):
                        log(f"  Record {i+1}: {rec['start']} to {rec['end']} - {rec['value']} ({rec['duration']:.1f} min)")
                    del data["debug_records"]
                
                # Only include dates with sleep data
                if any(data.values()):
                    result.append(data)
            
            log(f"\nReturning {len(result)} days of sleep data")
            
            # Sort by date and limit to requested days
            result = sorted(result, key=lambda x: x["date"], reverse=True)[:days]
            
            return result
            
        except Exception as e:
            print(f"Error in get_sleep_data: {e}")
            return default_return
            
    def parse_activity_data(self, days: int = 30) -> List[Dict[str, Any]]:
        """Parse activity data from the export.xml file using a streaming approach."""
        if not self.export_file_path.exists():
            raise FileNotFoundError(f"Export file not found: {self.export_file_path}")
        
        # Limit to max 30 days for performance
        days = min(days, 30)
        
        # Calculate date range (include full days from start of start date to end of end date)
        end_date = datetime.now().replace(hour=23, minute=59, second=59, microsecond=999999)
        start_date = (end_date - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
        start_date_str = start_date.strftime('%Y-%m-%d')
        
        # Track sources of step counts
        source_counts = defaultdict(lambda: defaultdict(int))  # date -> source -> count
        
        print(f"Parsing activity data from {start_date_str} to {end_date.strftime('%Y-%m-%d')}")
        
        # Initialize data structures with pre-allocated dates
        daily_data = {
            (start_date + timedelta(days=i)).strftime('%Y-%m-%d'): 
            ActivityRecord(date=(start_date + timedelta(days=i)).strftime('%Y-%m-%d'))
            for i in range(days)
        }
        
        # Initialize debug counters
        step_records = 0
        distance_records = 0
        energy_records = 0
        processed_count = 0
        record_count = 0
        
        print("Starting XML parsing...")
        
        # Parse records using iterparse for memory efficiency
        context = ET.iterparse(
            str(self.export_file_path),
            events=('end',),
            parser=ET.XMLParser(encoding='utf-8')
        )
        
        try:
            for event, elem in context:
                if elem.tag != 'Record':
                    elem.clear()
                    continue
                    
                record_count += 1
                if record_count % 10000 == 0:
                    print(f"Processed {record_count} records...")
                
                try:
                    record_type = elem.get('type')
                    if not record_type:
                        continue
                        
                    # Only process relevant record types
                    if record_type not in (RecordType.STEP_COUNT, RecordType.DISTANCE, RecordType.ACTIVE_ENERGY):
                        continue
                    
                    # Get record date
                    start_date_str = elem.get('startDate')
                    if not start_date_str:
                        continue
                        
                    record_date = start_date_str.split(' ')[0]  # Get just the date part
                    
                    # Skip if outside our date range
                    if record_date not in daily_data:
                        continue
                        
                    # Get record value and unit
                    value_str = elem.get('value')
                    unit = elem.get('unit', '').lower()
                    
                    if not value_str:
                        continue
                        
                    try:
                        value = float(value_str)
                    except (ValueError, TypeError):
                        continue
                        
                    # Handle different units and conversions
                    if record_type == RecordType.STEP_COUNT:
                        step_value = int(value)
                        source = elem.get('sourceName', 'unknown').lower()
                        
                        # Track step counts by source
                        source_counts[record_date][source] += step_value
                        
                        # Only count steps from Apple Watch
                        if 'watch' in source:
                            daily_data[record_date].steps += step_value
                            step_records += 1
                            
                            # Log details for June 13th and 14th steps
                            if record_date in ['2025-06-13', '2025-06-14']:
                                start_time = elem.get('startDate', 'unknown')
                                end_time = elem.get('endDate', 'unknown')
                                print(f"Apple Watch step record on {record_date}: {step_value} steps from {start_time} to {end_time} (Source: {source})")
                        else:
                            # Log non-watch steps for debugging
                            if record_date in ['2025-06-13', '2025-06-14']:
                                print(f"Ignoring {step_value} steps from {source}")
                        
                    elif record_type == RecordType.DISTANCE and 'watch' in source.lower():
                        # Only process distance from Apple Watch
                        distance_km = 0
                        if 'mi' in unit:  # miles to km
                            distance_km = value * 1.60934
                        elif 'ft' in unit:  # feet to km
                            distance_km = value * 0.0003048
                        elif 'm' in unit:  # meters to km
                            distance_km = value / 1000
                        else:  # assume meters if no unit specified
                            distance_km = value / 1000
                        
                        daily_data[record_date].distance += distance_km
                        distance_records += 1
                        
                        if record_date in ['2025-06-13', '2025-06-14']:
                            print(f"Apple Watch distance on {record_date}: {distance_km:.2f} km (Source: {source})")
                        
                    elif record_type == RecordType.ACTIVE_ENERGY and 'watch' in source.lower():
                        # Only process active energy from Apple Watch
                        energy_kcal = 0
                        if 'kj' in unit:  # kilojoules to kcal
                            energy_kcal = value * 0.239006
                        elif 'j' in unit:  # joules to kcal
                            energy_kcal = value * 0.000239006
                        else:  # assume kcal if no unit specified
                            energy_kcal = value
                            
                        daily_data[record_date].active_energy_burned += energy_kcal
                        energy_records += 1
                        
                        if record_date in ['2025-06-13', '2025-06-14']:
                            print(f"Apple Watch energy on {record_date}: {energy_kcal:.1f} kcal (Source: {source})")
                        
                    processed_count += 1
                        
                except (ValueError, AttributeError, TypeError) as e:
                    # Skip malformed records
                    continue
                finally:
                    # Clear the element to free memory
                    elem.clear()
                        
        except ET.ParseError as e:
            raise ValueError(f"Error parsing XML file: {e}")
        finally:
            # Clean up
            del context
        
        # Convert to list of dicts and sort by date
        result = [record.to_dict() for record in daily_data.values()]
        result.sort(key=lambda x: x['date'])
        
        # Print debug information
        print(f"\nParsing complete. Processed {record_count} total records")
        print(f"Found {step_records} step records")
        
        # Print step counts by source for each day
        print("\nStep counts by source:")
        for date in sorted(daily_data.keys(), reverse=True)[:7]:  # Last 7 days
            print(f"\n{date} - Total: {daily_data[date].steps}")
            if date in source_counts:
                for source, count in source_counts[date].items():
                    print(f"  {source}: {count}")
        
        # Print total steps for recent days
        print("\nTotal steps by day:")
        for date in sorted(daily_data.keys(), reverse=True)[:7]:
            print(f"{date}: {daily_data[date].steps}")
            
        print(f"\nFound {distance_records} distance records")
        print(f"Found {energy_records} energy records")
        print(f"Successfully processed {processed_count} records")
        
        # Print summary of data
        print("\nDaily summary:")
        for day in result:
            print(f"{day['date']}: {day['steps']} steps, {day['distance']:.2f} km, {day['activeEnergyBurned']:.1f} kcal")
        
        return result
