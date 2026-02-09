// =============================================================================
// Digital Twin Viewer - Interactive view of the building model
// Shows building stats, floors, rooms, and all extracted elements
// =============================================================================

import { useState } from 'react';
import type { DigitalTwin, Floor } from '../types';
import { ROOM_TYPE_LABELS } from '../constants';

interface DigitalTwinViewerProps {
  twin: DigitalTwin;
}

export function DigitalTwinViewer({ twin }: DigitalTwinViewerProps) {
  const [selectedFloor, setSelectedFloor] = useState(0);
  const building = twin.building;
  const floor = building.floors[selectedFloor];

  return (
    <div className="bg-white dark:bg-dark-base-medium rounded-xl border border-border-color dark:border-dark-border-color">
      <div className="p-4 border-b border-border-color dark:border-dark-border-color flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary dark:text-dark-text-primary">
            Digital Twin: {building.name}
          </h3>
          <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
            {twin.verified
              ? <span className="text-green-600">Verified</span>
              : <span className="text-yellow-600">Awaiting Verification</span>
            }
          </p>
        </div>
      </div>

      {/* Building Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
        <StatCard label="Stories" value={building.stories} />
        <StatCard label="Total Sqft" value={building.total_sqft.toLocaleString()} />
        <StatCard label="Footprint" value={`${building.footprint_sqft.toLocaleString()} sqft`} />
        <StatCard label="Roof Type" value={building.roof.type} />
        <StatCard label="Foundation" value={building.foundation.type} />
      </div>

      {/* Floor selector */}
      {building.floors.length > 1 && (
        <div className="px-4 pb-2 flex gap-2">
          {building.floors.map((f, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedFloor(idx)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${idx === selectedFloor
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-dark-base-light text-text-secondary dark:text-dark-text-secondary hover:bg-gray-200'
                }
              `}
            >
              {f.name || `Floor ${f.level}`}
            </button>
          ))}
        </div>
      )}

      {/* Floor Details */}
      {floor && <FloorView floor={floor} />}

      {/* Roof & Exterior Info */}
      <div className="p-4 border-t border-border-color dark:border-dark-border-color grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-dark-base-light rounded-lg p-4">
          <h4 className="font-medium text-text-primary dark:text-dark-text-primary mb-2">Roof</h4>
          <div className="space-y-1 text-sm text-text-secondary dark:text-dark-text-secondary">
            <p>Type: <span className="font-medium">{building.roof.type}</span></p>
            <p>Area: <span className="font-medium">{building.roof.total_sqft.toLocaleString()} sqft</span></p>
            <p>Pitch: <span className="font-medium">{building.roof.pitch}</span></p>
            <p>Overhang: <span className="font-medium">{building.roof.overhang_ft} ft</span></p>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-dark-base-light rounded-lg p-4">
          <h4 className="font-medium text-text-primary dark:text-dark-text-primary mb-2">Exterior</h4>
          <div className="space-y-1 text-sm text-text-secondary dark:text-dark-text-secondary">
            <p>Siding: <span className="font-medium">{building.exterior.siding_type}</span></p>
            <p>Ext. Wall Area: <span className="font-medium">{building.exterior.total_exterior_wall_sqft.toLocaleString()} sqft</span></p>
            <p>Foundation: <span className="font-medium">{building.foundation.type}</span></p>
            <p>Foundation Depth: <span className="font-medium">{building.foundation.depth_ft} ft</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloorView({ floor }: { floor: Floor }) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-text-primary dark:text-dark-text-primary">
          {floor.name} (Ceiling: {floor.ceiling_height_ft} ft)
        </h4>
        <div className="flex gap-4 text-sm text-text-secondary dark:text-dark-text-secondary">
          <span>{floor.walls.length} walls</span>
          <span>{floor.doors.length} doors</span>
          <span>{floor.windows.length} windows</span>
          <span>{floor.fixtures.length} fixtures</span>
        </div>
      </div>

      {/* Rooms grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {floor.rooms.map(room => (
          <div
            key={room.id}
            className="bg-gray-50 dark:bg-dark-base-light rounded-lg p-3 border border-border-color dark:border-dark-border-color"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-text-primary dark:text-dark-text-primary text-sm">
                  {room.name}
                </p>
                <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary">
                  {ROOM_TYPE_LABELS[room.room_type] || room.room_type}
                </p>
              </div>
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {room.area_sqft.toFixed(0)} sqft
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-text-secondary dark:text-dark-text-secondary">
              <span>Perimeter: {room.perimeter_ft.toFixed(1)} ft</span>
              <span>Height: {room.ceiling_height_ft} ft</span>
              <span>Floor: {room.floor_material}</span>
              <span>Walls: {room.wall_material}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Fixtures list */}
      {floor.fixtures.length > 0 && (
        <div>
          <h5 className="text-sm font-medium text-text-primary dark:text-dark-text-primary mb-2">
            Fixtures & Equipment
          </h5>
          <div className="flex flex-wrap gap-2">
            {floor.fixtures.map(f => (
              <span key={f.id} className="px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                {f.fixture_type.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 dark:bg-dark-base-light rounded-lg p-3 text-center">
      <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary">{label}</p>
      <p className="font-semibold text-text-primary dark:text-dark-text-primary text-sm capitalize">
        {value}
      </p>
    </div>
  );
}
