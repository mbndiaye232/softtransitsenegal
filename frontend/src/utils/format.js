/**
 * Format a number with French thousands separators (space).
 * @param {number|string} n - The number to format
 * @param {number} decimals - Number of decimal places (default 0)
 * @returns {string} Formatted number, e.g. "1 234 567"
 */
export function fmt(n, decimals = 0) {
    const num = parseFloat(n);
    if (isNaN(num)) return '0';
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

// Pour un montant suivi de la devise de référence courante ("FC" par défaut,
// modifiable sans toucher au code), voir fmtRef dans ./currency.js
