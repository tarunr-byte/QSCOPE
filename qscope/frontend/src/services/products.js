/**
 * QSCOPE Product & Sensor Catalog
 * 
 * Defines hardware targets, physics parameters, and sensor datasets
 * for the IBM Quantum-inspired QSCOPE platform.
 */

export const SENSOR_PRODUCTS = [
  {
    id: 'cag-87',
    code: 'CAG-87',
    productName: 'Cold-Atom Gravimeter CAG-87',
    sensorName: 'Rubidium-87 Atom Interferometer',
    sensorFamily: 'Opto-Atomic Gravimetry',
    badge: 'Hardware Active',
    badgeVariant: 'green',
    description: 'Precision absolute gravity & gravity-gradient observation using laser-cooled 87Rb atoms in a Raman π/2–π–π/2 pulse sequence.',
    physics: {
      interferometerType: 'Mach-Zehnder Raman Light-Pulse',
      effectiveWavevector: '1.61 × 10⁷ m⁻¹ (780 nm D2 line)',
      interrogationTimeT: '60 ms',
      atomCountDefault: 2500,
      baselineContrast: 0.88,
      nominalPhase: 0.42,
      baseAccelZ: 9.80665,
      frequency: 1.8,
      vibrationNoise: 0.018,
      threshold: 0.067349,
      unit: 'm/s²',
      primaryMetricName: 'Gravity g (m/s²)',
    },
    specs: [
      { label: 'Atomic Cloud', value: '²S₁/₂ ⁸⁷Rb (F=1, mF=0)' },
      { label: 'Laser Lock', value: 'Ultra-stable Cavity Ref.' },
      { label: 'Effective Scale Factor', value: 'k_eff · T² ≈ 5.79 × 10⁴ s²' },
      { label: 'Q-SCOPE Boundary', value: 'd_mean ≤ 0.067349 (EKF Valid)' },
    ],
    generateWindow: (windowIdx = 0, isDrifting = false) => {
      const n = 60;
      const timestamps = [];
      const population = [];
      const phase_signal = [];
      const accel_x = [];
      const accel_y = [];
      const accel_z = [];
      const contrast = [];
      const atom_count = [];

      const baseT = windowIdx * 1.2;
      const noise = isDrifting ? 0.065 : 0.018;
      const gOffset = isDrifting ? 0.12 * Math.sin(windowIdx * 0.4) : 0.0;

      for (let i = 0; i < n; i++) {
        const t = baseT + i * 0.02;
        timestamps.push(Number(t.toFixed(4)));

        // Microseismic vibration + Earth tides
        const seismic = 0.012 * Math.sin(2 * Math.PI * 0.15 * t) + (Math.random() - 0.5) * noise;
        const phase = 0.42 + 0.28 * Math.sin(2 * Math.PI * 1.8 * t) + seismic + (isDrifting ? 0.25 : 0.0);
        phase_signal.push(Number(phase.toFixed(5)));

        // Fringe population: P = 0.5 - 0.5 * C * cos(phi)
        const p = 0.5 - 0.5 * 0.88 * Math.cos(phase) + (Math.random() - 0.5) * (noise * 0.6);
        population.push(Number(Math.max(0.01, Math.min(0.99, p)).toFixed(5)));

        accel_x.push(Number(((Math.random() - 0.5) * 0.004).toFixed(5)));
        accel_y.push(Number(((Math.random() - 0.5) * 0.004).toFixed(5)));
        accel_z.push(Number((9.80665 + gOffset + (Math.random() - 0.5) * noise * 0.8).toFixed(5)));
        contrast.push(Number((0.88 - (isDrifting ? 0.08 : 0.0) + (Math.random() - 0.5) * 0.02).toFixed(4)));
        atom_count.push(Math.round(2500 + (Math.random() - 0.5) * 120));
      }

      return {
        window_id: String(windowIdx),
        run_id: `run_cag87_w${windowIdx}`,
        timestamps,
        population,
        phase_signal,
        accel_x,
        accel_y,
        accel_z,
        contrast,
        atom_count,
      };
    }
  },
  {
    id: 'q-imu',
    code: 'Q-IMU-X4',
    productName: 'Quantum Inertial Unit Q-IMU-X4',
    sensorName: 'Dual-Beam Sagnac Precession Gyroscope',
    sensorFamily: 'Quantum Inertial Navigation',
    badge: 'Hardware Active',
    badgeVariant: 'teal',
    description: 'Dynamic strapdown inertial observation utilizing cold-atom Sagnac area-enclosed trajectories for GPS-denied navigation.',
    physics: {
      interferometerType: 'Enclosed Area Sagnac Interferometer',
      effectiveWavevector: '2.14 × 10⁷ m⁻¹',
      interrogationTimeT: '40 ms',
      atomCountDefault: 1800,
      baselineContrast: 0.82,
      nominalPhase: 0.58,
      baseAccelZ: 9.805,
      frequency: 2.4,
      vibrationNoise: 0.028,
      threshold: 0.071200,
      unit: 'rad/s',
      primaryMetricName: 'Sagnac Rotation Ω (rad/s)',
    },
    specs: [
      { label: 'Atomic Cloud', value: 'Trapped Cold ⁸⁵Rb / ⁸⁷Rb' },
      { label: 'Enclosed Area', value: '18.4 mm² folded beam' },
      { label: 'Scale Factor', value: '4π / (ħc²) · m A ≈ 1.82 × 10⁶ rad/(rad/s)' },
      { label: 'Q-SCOPE Boundary', value: 'd_mean ≤ 0.071200' },
    ],
    generateWindow: (windowIdx = 0, isDrifting = false) => {
      const n = 60;
      const timestamps = [];
      const population = [];
      const phase_signal = [];
      const accel_x = [];
      const accel_y = [];
      const accel_z = [];
      const contrast = [];
      const atom_count = [];

      const baseT = windowIdx * 1.0;
      const noise = isDrifting ? 0.08 : 0.028;

      for (let i = 0; i < n; i++) {
        const t = baseT + i * 0.016;
        timestamps.push(Number(t.toFixed(4)));

        const rotRate = 0.005 * Math.sin(2 * Math.PI * 0.8 * t) + (isDrifting ? 0.035 : 0.0);
        const phase = 0.58 + rotRate * 8.5 + (Math.random() - 0.5) * noise;
        phase_signal.push(Number(phase.toFixed(5)));

        const p = 0.5 - 0.5 * 0.82 * Math.cos(phase) + (Math.random() - 0.5) * (noise * 0.5);
        population.push(Number(Math.max(0.01, Math.min(0.99, p)).toFixed(5)));

        accel_x.push(Number((0.08 * Math.cos(2 * t) + (Math.random() - 0.5) * noise).toFixed(5)));
        accel_y.push(Number((0.06 * Math.sin(2 * t) + (Math.random() - 0.5) * noise).toFixed(5)));
        accel_z.push(Number((9.805 + (Math.random() - 0.5) * noise * 0.5).toFixed(5)));
        contrast.push(Number((0.82 + (Math.random() - 0.5) * 0.03).toFixed(4)));
        atom_count.push(Math.round(1800 + (Math.random() - 0.5) * 90));
      }

      return {
        window_id: String(windowIdx),
        run_id: `run_qimu_w${windowIdx}`,
        timestamps,
        population,
        phase_signal,
        accel_x,
        accel_y,
        accel_z,
        contrast,
        atom_count,
      };
    }
  },
  {
    id: 'opm-serf',
    code: 'OPM-SERF',
    productName: 'SERF Atomic Magnetometer OPM-3',
    sensorName: 'Spin-Exchange Relaxation-Free Vapor Cell',
    sensorFamily: 'Quantum Biomagnetometry & Geophysics',
    badge: 'Hardware Active',
    badgeVariant: 'purple',
    description: 'Non-cryogenic femtotesla magnetic anomaly observation via optical pumping and Larmor precession in high-density rubidium vapor.',
    physics: {
      interferometerType: 'SERF Optical Polarimetry Precession',
      effectiveWavevector: 'N/A (Optical Absorption)',
      interrogationTimeT: '15 ms',
      atomCountDefault: 5000,
      baselineContrast: 0.94,
      nominalPhase: 0.35,
      baseAccelZ: 9.81,
      frequency: 2.1,
      vibrationNoise: 0.012,
      threshold: 0.058100,
      unit: 'fT',
      primaryMetricName: 'Magnetic Field B (fT)',
    },
    specs: [
      { label: 'Vapor Cell', value: 'Enriched ⁸⁷Rb + 50 Torr N₂ buffer' },
      { label: 'Operating Temp', value: '185 °C (Zero-field SERF regime)' },
      { label: 'Bandwidth', value: 'DC to 120 Hz' },
      { label: 'Q-SCOPE Boundary', value: 'd_mean ≤ 0.058100' },
    ],
    generateWindow: (windowIdx = 0, isDrifting = false) => {
      const n = 60;
      const timestamps = [];
      const population = [];
      const phase_signal = [];
      const accel_x = [];
      const accel_y = [];
      const accel_z = [];
      const contrast = [];
      const atom_count = [];

      const baseT = windowIdx * 0.8;
      const noise = isDrifting ? 0.045 : 0.012;

      for (let i = 0; i < n; i++) {
        const t = baseT + i * 0.012;
        timestamps.push(Number(t.toFixed(4)));

        const magField = 0.08 * Math.sin(2 * Math.PI * 1.2 * t) + (isDrifting ? 0.22 : 0.0);
        const phase = 0.35 + magField * 2.2 + (Math.random() - 0.5) * noise;
        phase_signal.push(Number(phase.toFixed(5)));

        const p = 0.5 - 0.5 * 0.94 * Math.cos(phase) + (Math.random() - 0.5) * (noise * 0.4);
        population.push(Number(Math.max(0.01, Math.min(0.99, p)).toFixed(5)));

        accel_x.push(Number(((Math.random() - 0.5) * 0.002).toFixed(5)));
        accel_y.push(Number(((Math.random() - 0.5) * 0.002).toFixed(5)));
        accel_z.push(Number((9.81 + (Math.random() - 0.5) * 0.005).toFixed(5)));
        contrast.push(Number((0.94 + (Math.random() - 0.5) * 0.015).toFixed(4)));
        atom_count.push(Math.round(5000 + (Math.random() - 0.5) * 200));
      }

      return {
        window_id: String(windowIdx),
        run_id: `run_serf_w${windowIdx}`,
        timestamps,
        population,
        phase_signal,
        accel_x,
        accel_y,
        accel_z,
        contrast,
        atom_count,
      };
    }
  },
  {
    id: 'sqg-cryo',
    code: 'SQG-CRYO',
    productName: 'Superconducting Metrology SQG-7',
    sensorName: 'Flux-Qubit Josephson Sensor Link',
    sensorFamily: 'Superconducting Quantum Metrology',
    badge: 'Hardware Active',
    badgeVariant: 'blue',
    description: 'Sub-millikelvin superconducting circuit measuring discrete quantum flux transitions coupled with resonant optomechanics.',
    physics: {
      interferometerType: 'Josephson Phase Qubit Loop',
      effectiveWavevector: 'Dispersive Cavity Readout',
      interrogationTimeT: '5 ms',
      atomCountDefault: 4000,
      baselineContrast: 0.91,
      nominalPhase: 0.49,
      baseAccelZ: 9.807,
      frequency: 2.8,
      vibrationNoise: 0.016,
      threshold: 0.062000,
      unit: 'Φ₀ (flux quanta)',
      primaryMetricName: 'Flux Bias Φ/Φ₀',
    },
    specs: [
      { label: 'Circuit Material', value: 'Al/AlOx/Al on Sapphire substrate' },
      { label: 'Cryostat Temp', value: '15 mK (Dilution Refrigerator)' },
      { label: 'Readout Resonator', value: '6.42 GHz Coplanar Waveguide' },
      { label: 'Q-SCOPE Boundary', value: 'd_mean ≤ 0.062000' },
    ],
    generateWindow: (windowIdx = 0, isDrifting = false) => {
      const n = 60;
      const timestamps = [];
      const population = [];
      const phase_signal = [];
      const accel_x = [];
      const accel_y = [];
      const accel_z = [];
      const contrast = [];
      const atom_count = [];

      const baseT = windowIdx * 0.6;
      const noise = isDrifting ? 0.052 : 0.016;

      for (let i = 0; i < n; i++) {
        const t = baseT + i * 0.01;
        timestamps.push(Number(t.toFixed(4)));

        const fluxNoise = 0.04 * Math.sin(2 * Math.PI * 2.8 * t) + (isDrifting ? 0.18 : 0.0);
        const phase = 0.49 + fluxNoise + (Math.random() - 0.5) * noise;
        phase_signal.push(Number(phase.toFixed(5)));

        const p = 0.5 - 0.5 * 0.91 * Math.cos(phase) + (Math.random() - 0.5) * (noise * 0.4);
        population.push(Number(Math.max(0.01, Math.min(0.99, p)).toFixed(5)));

        accel_x.push(Number(((Math.random() - 0.5) * 0.003).toFixed(5)));
        accel_y.push(Number(((Math.random() - 0.5) * 0.003).toFixed(5)));
        accel_z.push(Number((9.807 + (Math.random() - 0.5) * 0.004).toFixed(5)));
        contrast.push(Number((0.91 + (Math.random() - 0.5) * 0.02).toFixed(4)));
        atom_count.push(Math.round(4000 + (Math.random() - 0.5) * 150));
      }

      return {
        window_id: String(windowIdx),
        run_id: `run_sqg_w${windowIdx}`,
        timestamps,
        population,
        phase_signal,
        accel_x,
        accel_y,
        accel_z,
        contrast,
        atom_count,
      };
    }
  }
];

export function getProductById(id) {
  return SENSOR_PRODUCTS.find(p => p.id === id) || SENSOR_PRODUCTS[0];
}
