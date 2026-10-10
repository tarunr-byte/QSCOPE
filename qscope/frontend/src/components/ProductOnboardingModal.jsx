import React, { useState } from 'react';
import { X, Check, ArrowRight, Cpu, Activity, ShieldCheck, Zap } from 'lucide-react';
import { SENSOR_PRODUCTS } from '../services/products';

export default function ProductOnboardingModal({
  isOpen,
  onClose,
  activeProduct,
  onSelectProduct,
}) {
  const [selected, setSelected] = useState(activeProduct);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-qnavy/40 backdrop-blur-xs select-none">
      <div className="bg-qpure border border-qborder w-full max-w-4xl max-h-[90vh] flex flex-col shadow-carbon-lg">
        {/* Header */}
        <div className="h-12 border-b border-qborder px-4 flex items-center justify-between bg-qarctic">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 bg-qblue" />
            <h2 className="text-xs font-semibold text-qnavy uppercase tracking-wider font-mono">
              QSCOPE Target Hardware & Sensor Configuration
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-qslate hover:text-qnavy hover:bg-qpure transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-qnavy">
              Select Quantum Sensor Platform
            </h3>
            <p className="text-xs text-qslate mt-1 max-w-2xl leading-relaxed">
              QSCOPE provides statevector-simulated telemetry, non-linear discrepancy certification, 
              and Extended Kalman Filter tracking across high-precision atomic and solid-state sensors. 
              Select a hardware instrument to load its physical profile, atom count, and calibrated baseline dataset.
            </p>
          </div>

          {/* Grid of 4 sensor products */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SENSOR_PRODUCTS.map((prod) => {
              const isCurrent = selected.id === prod.id;

              return (
                <div
                  key={prod.id}
                  onClick={() => setSelected(prod)}
                  className={`p-4 border transition-all cursor-pointer relative ${
                    isCurrent
                      ? 'border-qblue bg-qblue-subtle/30 ring-1 ring-qblue'
                      : 'border-qborder bg-qpure hover:border-qslate-light hover:bg-qarctic/40'
                  }`}
                >
                  {/* Top Bar with Badge */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-qnavy">
                          {prod.code}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-qarctic border border-qborder text-qslate">
                          {prod.sensorFamily}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-qnavy mt-0.5">
                        {prod.productName}
                      </div>
                    </div>

                    <div className="w-5 h-5 border border-qborder rounded-full flex items-center justify-center bg-qpure">
                      {isCurrent && <div className="w-2.5 h-2.5 rounded-full bg-qblue" />}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-qslate mt-2 leading-relaxed">
                    {prod.description}
                  </p>

                  {/* Physics Specs Table */}
                  <div className="mt-3 pt-2.5 border-t border-qborder grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div>
                      <span className="text-qslate-light block">Atom Count (N)</span>
                      <span className="text-qnavy font-semibold">{prod.physics.atomCountDefault.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-qslate-light block">Fringe Contrast</span>
                      <span className="text-qteal font-semibold">C = {prod.physics.baselineContrast}</span>
                    </div>
                    <div>
                      <span className="text-qslate-light block">Primary Metric</span>
                      <span className="text-qnavy font-semibold truncate block">{prod.physics.primaryMetricName}</span>
                    </div>
                    <div>
                      <span className="text-qslate-light block">Q-SCOPE Threshold</span>
                      <span className="text-qblue font-semibold">τ = {prod.physics.threshold}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active selection technical overview */}
          <div className="p-3 bg-qarctic border border-qborder flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-3">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-qgreen" />
              <span className="font-mono text-qnavy text-[11px]">
                Active Profile: <strong className="font-semibold">{selected.productName}</strong>
              </span>
              <span className="text-qslate-light">·</span>
              <span className="text-qslate text-[11px] font-mono">
                {selected.physics.interferometerType}
              </span>
            </div>
            <div className="text-[11px] font-mono text-qslate">
              Scale Factor: {selected.specs[2]?.value}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 border-t border-qborder px-6 flex items-center justify-between bg-qpure">
          <button
            onClick={onClose}
            className="px-4 h-9 border border-qborder text-xs text-qslate hover:text-qnavy hover:bg-qarctic transition-colors font-mono"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              onSelectProduct(selected);
              onClose();
            }}
            className="px-5 h-9 bg-qblue hover:bg-qblue-hover text-white text-xs font-semibold flex items-center space-x-2 transition-colors font-mono"
          >
            <span>Initialize Pipeline ({selected.code})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
