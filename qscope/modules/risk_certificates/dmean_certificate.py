import math
from typing import Dict, Any
from core.contracts import RiskCertificatePlugin, RiskCertificate

class DMeanCertificate(RiskCertificatePlugin):
    def evaluate(self, model_result, estimator_result, envelope, config) -> RiskCertificate:
        mu = estimator_result.phase_estimate_rad
        sigma = estimator_result.uncertainty_rad
        p0 = config.measurement_p0
        A = config.measurement_amplitude
        C = config.measurement_contrast
        N = config.shots

        var2 = sigma**2
        e_cos = math.cos(mu) * math.exp(-var2 / 2.0)
        e_cos2 = 0.5 * (1.0 + math.cos(2.0*mu) * math.exp(-2.0*var2))
        var_cos = max(0.0, e_cos2 - e_cos**2)

        e_p_phi = p0 + A * C * e_cos
        p_mu = p0 + A * C * math.cos(mu)
        var_p_phi = (A * C)**2 * var_cos

        denom = math.sqrt(var_p_phi + 1.0/(4.0*N)) if N > 0 else math.sqrt(var_p_phi)
        B = abs(e_p_phi - p_mu) / denom if denom > 0 else 0.0

        return RiskCertificate(
            score_name='dmean', score_value=B, score_lower=B*0.9, score_upper=B*1.1,
            inputs={'mu': mu, 'sigma': sigma}, assumptions=('gaussian',), limits=(),
            model_version='1.0', valid=True, sensitivity={}, data_quality_status='ok',
            warnings=(), reason=''
        )
