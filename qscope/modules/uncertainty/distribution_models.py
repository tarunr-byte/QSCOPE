import math

def gaussian_phase_moments(mu: float, sigma: float):
    var2 = sigma**2
    e_cos = math.cos(mu) * math.exp(-var2 / 2.0)
    e_cos2 = 0.5 * (1.0 + math.cos(2.0*mu) * math.exp(-2.0*var2))
    var_cos = max(0.0, e_cos2 - e_cos**2)
    return e_cos, var_cos

def uniform_phase_moments(a: float, b: float):
    diff = b - a
    if diff == 0: return math.cos(a), 0.0
    e_cos = (math.sin(b) - math.sin(a)) / diff
    e_cos2 = 0.5 * (1.0 + (math.sin(2.0*b) - math.sin(2.0*a)) / (2.0*diff))
    var_cos = max(0.0, e_cos2 - e_cos**2)
    return e_cos, var_cos
