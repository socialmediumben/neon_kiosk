/**
 * Social Medium Certifications & Icons Universal Library (SSOT)
 * Single Source of Truth for all Social Medium platforms:
 * - Social Medium Companion App
 * - Portal Door
 * - Check-In Kiosk
 * - Home Controller
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SMCertifications = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Vector SVG icon geometry (embedded for instant rendering across all platforms)
  var SVG_ICONS = {
    '3d-printing': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16M4 22h16M5 19V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M9 7h6M12 7v4l-1.5 2h3L12 11"/><path d="M9 19l3-3 3 3"/></svg>',
    'laser-cutting': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10v4l-3 4v2h-4v-2L7 7V3z"/><line x1="12" y1="13" x2="12" y2="19" stroke-dasharray="1 1"/><line x1="3" y1="21" x2="21" y2="21"/><path d="M10 19l2-2 2 2"/></svg>',
    'soldering': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5l-7 7M16 2l6 6-2 2-6-6 2-2z"/><path d="M12 12l-5 5-3 1 1-3 5-5"/><circle cx="4" cy="20" r="1.5" fill="currentColor"/><path d="M2 17l2 1M7 22l-1-2"/></svg>',
    'machine-sewing': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M4 21V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v13"/><path d="M8 8v7M7 15h2"/><circle cx="17" cy="8" r="2"/></svg>',
    'woodworking': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l12-12 4 4-12 12H4v-4z"/><path d="M7 14l2-1M10 11l2-1M13 8l2-1"/><circle cx="17" cy="17" r="4"/><circle cx="17" cy="17" r="1.5"/></svg>',
    'cnc-routing': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="6" rx="1"/><path d="M10 8v4l2 3 2-3V8z"/><line x1="12" y1="15" x2="12" y2="18"/><line x1="4" y1="20" x2="20" y2="20"/><path d="M7 17q2-2 5 0t5 0"/></svg>',
    'vinyl-cutting': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="6" rx="2"/><circle cx="6" cy="7" r="1.5" fill="currentColor"/><path d="M12 10v4l-1 2h2l-1-2"/><path d="M5 14h14v6H5z"/><path d="M8 17l2 2 4-4"/></svg>',
    'electronics': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/><circle cx="9" cy="9" r="1" fill="currentColor"/><line x1="2" y1="9" x2="6" y2="9"/><line x1="2" y1="15" x2="6" y2="15"/><line x1="18" y1="9" x2="22" y2="9"/><line x1="18" y1="15" x2="22" y2="15"/><line x1="9" y1="2" x2="9" y2="6"/><line x1="15" y1="2" x2="15" y2="6"/><line x1="9" y1="18" x2="9" y2="22"/><line x1="15" y1="18" x2="15" y2="22"/></svg>',
    'tool-generic': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
  };

  // Canonical tool taxonomy
  var TOOLS = {
    '3d-printing': {
      id: '3d-printing',
      name: '3D Printing',
      category: 'Digital Fabrication',
      color: '#3bc0cd',
      iconSvg: SVG_ICONS['3d-printing'],
      keywords: ['3d printing', 'fdm', 'resin', '3d printer', 'ender', 'bambu', 'prusa']
    },
    'laser-cutting': {
      id: 'laser-cutting',
      name: 'Laser Cutting',
      category: 'Digital Fabrication',
      color: '#f16622',
      iconSvg: SVG_ICONS['laser-cutting'],
      keywords: ['laser cutting', 'laser cutter', 'laser', 'glowforge', 'omtech']
    },
    'soldering': {
      id: 'soldering',
      name: 'Soldering',
      category: 'Electronics',
      color: '#344ea2',
      iconSvg: SVG_ICONS['soldering'],
      keywords: ['soldering', 'solder', 'circuit', 'pcb']
    },
    'machine-sewing': {
      id: 'machine-sewing',
      name: 'Machine Sewing',
      category: 'Textiles',
      color: '#8a9280',
      iconSvg: SVG_ICONS['machine-sewing'],
      keywords: ['machine sewing', 'sewing', 'embroidery', 'textile', 'serger']
    },
    'woodworking': {
      id: 'woodworking',
      name: 'Woodworking',
      category: 'Woodshop',
      color: '#f16622',
      iconSvg: SVG_ICONS['woodworking'],
      keywords: ['woodworking', 'woodshop', 'saw', 'table saw', 'miter saw', 'jointer', 'planer']
    },
    'cnc-routing': {
      id: 'cnc-routing',
      name: 'CNC Routing',
      category: 'Digital Fabrication',
      color: '#344ea2',
      iconSvg: SVG_ICONS['cnc-routing'],
      keywords: ['cnc', 'cnc routing', 'cnc router', 'milling', 'shapeoko']
    },
    'vinyl-cutting': {
      id: 'vinyl-cutting',
      name: 'Vinyl Cutting',
      category: 'Digital Fabrication',
      color: '#3bc0cd',
      iconSvg: SVG_ICONS['vinyl-cutting'],
      keywords: ['vinyl', 'vinyl cutting', 'cricut', 'silhouette', 'heat press']
    },
    'electronics': {
      id: 'electronics',
      name: 'Electronics',
      category: 'Electronics',
      color: '#344ea2',
      iconSvg: SVG_ICONS['electronics'],
      keywords: ['electronics', 'arduino', 'raspberry pi', 'esp32', 'breadboard']
    }
  };

  /**
   * Resolves a single certification string (e.g. "3D Printing (Advanced)")
   * Rule: Base icon represents Beginner. If Advanced, isAdvanced = true & badge = "+".
   */
  function resolve(certString) {
    if (!certString || typeof certString !== 'string') {
      return null;
    }

    var clean = certString.trim();
    var lower = clean.toLowerCase();

    // Check if certification is marked Advanced
    var isAdvanced = lower.indexOf('advanced') !== -1 || lower.indexOf('master') !== -1 || lower.indexOf('level 2') !== -1;
    var level = isAdvanced ? 'Advanced' : 'Beginner';
    var badge = isAdvanced ? '+' : '';

    // Match against canonical tool definitions
    var matchedToolId = null;
    var toolKeys = Object.keys(TOOLS);

    for (var i = 0; i < toolKeys.length; i++) {
      var key = toolKeys[i];
      var toolDef = TOOLS[key];
      var keywords = toolDef.keywords || [];

      for (var k = 0; k < keywords.length; k++) {
        if (lower.indexOf(keywords[k]) !== -1) {
          matchedToolId = key;
          break;
        }
      }
      if (matchedToolId) break;
    }

    var baseTool = matchedToolId ? TOOLS[matchedToolId] : {
      id: 'tool-generic',
      name: clean.replace(/\((.*?)\)/g, '').trim(),
      category: 'Equipment',
      color: '#344ea2',
      iconSvg: SVG_ICONS['tool-generic']
    };

    return {
      rawString: clean,
      toolId: baseTool.id,
      name: baseTool.name,
      category: baseTool.category,
      color: baseTool.color,
      level: level,
      isAdvanced: isAdvanced,
      badge: badge,
      iconSvg: baseTool.iconSvg
    };
  }

  /**
   * Deduplicates a list of certification strings by canonical tool.
   * If a user has both Beginner and Advanced for the same tool,
   * Advanced (with "+") supersedes Beginner.
   */
  function dedupeAndGroup(certsList) {
    if (!Array.isArray(certsList)) return [];

    var toolMap = {};

    certsList.forEach(function (item) {
      var str = typeof item === 'object' && item !== null ? (item.name || item.value || '') : String(item);
      var resolved = resolve(str);
      if (!resolved) return;

      var existing = toolMap[resolved.toolId];
      if (!existing) {
        toolMap[resolved.toolId] = resolved;
      } else if (resolved.isAdvanced && !existing.isAdvanced) {
        // Upgrade to Advanced
        toolMap[resolved.toolId] = resolved;
      }
    });

    return Object.keys(toolMap).map(function (k) {
      return toolMap[k];
    });
  }

  /**
   * Generates Nametag HTML for the Check-In Kiosk.
   * Renders solid black icons with bold '+' for high-contrast thermal printing.
   */
  function renderNametagIcons(certsList) {
    var items = dedupeAndGroup(certsList);
    if (items.length === 0) return '';

    var html = '<div class="nametag-certs-row flex items-center gap-4 mt-6 pt-6 border-t-4 border-black">';
    html += '<div class="text-2xl font-black uppercase text-black tracking-wider">Certified:</div>';
    html += '<div class="flex items-center gap-5 flex-wrap">';

    items.forEach(function (item) {
      // Clean pure black SVG for thermal printing
      var blackSvg = item.iconSvg.replace(/stroke="currentColor"/g, 'stroke="#000000"').replace(/width="24" height="24"/g, 'width="36" height="36"');
      html += '<div class="flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-xl border-2 border-black" title="' + item.name + (item.isAdvanced ? ' (Advanced)' : '') + '">';
      html += '<div class="w-9 h-9 flex items-center justify-center shrink-0">' + blackSvg + '</div>';
      html += '<span class="text-xl font-black text-black">' + item.name + '</span>';
      if (item.isAdvanced) {
        html += '<span class="text-2xl font-black text-black leading-none ml-0.5">+</span>';
      }
      html += '</div>';
    });

    html += '</div></div>';
    return html;
  }

  /**
   * Generates colored UI Badges for Portal Door passport and Companion App.
   */
  function renderColorBadges(certsList) {
    var items = dedupeAndGroup(certsList);
    if (items.length === 0) return '<div class="cert-empty">No tool certifications recorded yet.</div>';

    var html = '';
    items.forEach(function (item) {
      var colorSvg = item.iconSvg.replace(/stroke="currentColor"/g, 'stroke="' + item.color + '"');
      html += '<div class="cert-item" style="border-left: 3px solid ' + item.color + '">';
      html += '  <div class="cert-icon-box shrink-0" style="color: ' + item.color + '">';
      html += '    ' + colorSvg;
      html += '  </div>';
      html += '  <div class="cert-details flex-1 ml-2 text-left">';
      html += '    <div class="cert-name font-bold text-sm text-stone-900">' + item.name;
      if (item.isAdvanced) {
        html += ' <span class="cert-plus-tag inline-block px-1.5 py-0.2 rounded font-black text-xs text-white" style="background:' + item.color + '" title="Advanced Certification">+</span>';
      }
      html += '    </div>';
      html += '    <div class="cert-category text-xs text-stone-500">' + item.category + ' • ' + item.level + '</div>';
      html += '  </div>';
      html += '  <span class="cert-tag text-xs font-semibold px-2 py-0.5 rounded-full" style="background:' + item.color + '15; color:' + item.color + '">Authorized</span>';
      html += '</div>';
    });

    return html;
  }

  return {
    TOOLS: TOOLS,
    SVG_ICONS: SVG_ICONS,
    resolve: resolve,
    dedupeAndGroup: dedupeAndGroup,
    renderNametagIcons: renderNametagIcons,
    renderColorBadges: renderColorBadges
  };
}));
