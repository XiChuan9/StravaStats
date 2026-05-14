# 🎨 CSS Theme & Color System Guide

## Overview

El proyecto Strava Dashboard ahora tiene un **sistema centralizado de colores y temas** basado en CSS custom properties (variables).

Todos los colores, espacios, sombras y tipografía pueden cambiarse desde **un único archivo**: `styles/colors.css`

---

## 📁 Estructura CSS

```
styles/
├── colors.css                      ← Variables de colores (EDITA AQUÍ)
├── responsive-components.css       ← Componentes reutilizables responsive
├── style.css                       ← Base global (ahora usa colors.css)
├── dashboard.css                   ← Tab: Dashboard
├── run.css                         ← Tab: Run
├── bike.css                        ← Tab: Bike
├── swim.css                        ← Tab: Swim
├── gear.css                        ← Tab: Gear
├── activities.css                  ← Tab: Activities
├── calendar.css                    ← Tab: Calendar
├── weather.css                     ← Tab: Weather
├── map.css                         ← Tab: Map
├── predictor.css                   ← Tab: Predictor
├── report.css                      ← Tab: Report
```

**Orden de carga en `index.html`:**
```html
<!-- Framework & Themes First -->
<link rel="stylesheet" href="styles/colors.css">
<link rel="stylesheet" href="styles/responsive-components.css">
<link rel="stylesheet" href="styles/style.css">

<!-- Tab-specific Styles -->
<link rel="stylesheet" href="styles/run.css">
<link rel="stylesheet" href="styles/bike.css">
<!-- ... etc -->
```

---

## 🎯 Cómo cambiar colores

### 1. **Color Principal (Naranja Strava)**

En `colors.css`, línea ~5:

```css
:root {
    --color-primary: #fc4c02;              /* ← Cambia aquí */
    --color-primary-light: #ffcc99;
    --color-primary-dark: #d84300;
}
```

**Efecto:** Cambia botones, enlaces, acentos principales en toda la app.

---

### 2. **Colores de Deportes**

```css
/* SPORT COLORS */
--color-sport-run: #2e7d32;        /* Verde para Running */
--color-sport-bike: #1565c0;       /* Azul para Ciclismo */
--color-sport-swim: #00838f;       /* Cyan para Natación */
--color-sport-hike: #7b2d26;       /* Marrón para Senderismo */
--color-sport-trail: #5d4e37;      /* Gris-marrón para Trail */
```

Usa estos en tabs específicos. Ej:

```css
#run-tab .chart-container {
    border-top: 4px solid var(--color-sport-run);
}
```

---

### 3. **Paleta de Texto**

```css
--color-text-dark: #232323;         /* Encabezados, texto principal */
--color-text-medium: #595959;       /* Texto normal */
--color-text-light: #8c8c8c;        /* Texto secundario, labels */
--color-text-lighter: #ababab;      /* Placeholder, disabled */
```

---

### 4. **Colores de Fondo**

```css
--color-bg-page: #f8fafc;           /* Fondo de página */
--color-bg-main: #f7f7f7;           /* Fondo secundario */
--color-bg-card: #ffffff;           /* Cards, containers */
--color-bg-hover: #f3f4f6;          /* Hover state */
```

---

### 5. **Bordes & Divisores**

```css
--color-border: #e8e8e8;            /* Bordes normales */
--color-border-light: #f1f1f1;      /* Bordes sutiles */
--color-border-dark: #d0d0d0;       /* Bordes oscuros */
```

---

### 6. **Colores de Estado**

```css
--color-success: #10b981;           /* Verde, completado */
--color-warning: #f59e0b;           /* Amarillo, atención */
--color-danger: #ef4444;            /* Rojo, error/alerta */
--color-info: #3b82f6;              /* Azul, información */
```

---

### 7. **Gradientes Predefinidos**

```css
--color-gradient-orange: linear-gradient(135deg, #fff4ec 0%, #ffffff 65%);
--color-gradient-blue: linear-gradient(135deg, #e8f4f8 0%, #ffffff 65%);
--color-gradient-green: linear-gradient(135deg, #edf5f0 0%, #ffffff 65%);
--color-gradient-purple: linear-gradient(135deg, #f3e8ff 0%, #ffffff 65%);
--color-gradient-cyan: linear-gradient(135deg, #e0f2fe 0%, #ffffff 65%);
```

Uso:

```css
.dashboard-hero {
    background: var(--color-gradient-orange);
}
```

---

## 📐 Sistema de Espacios

Todos los espacios usan escalas estándar:

```css
--spacing-xs: 0.25rem   /* 4px */
--spacing-sm: 0.5rem    /* 8px */
--spacing-md: 1rem      /* 16px */
--spacing-lg: 1.5rem    /* 24px */
--spacing-xl: 2rem      /* 32px */
--spacing-2xl: 3rem     /* 48px */
```

Uso:

```css
.card {
    padding: var(--spacing-md);
    gap: var(--spacing-lg);
    margin: var(--spacing-xl);
}
```

---

## 🔢 Sistema de Tipografía

### Font Sizes

```css
--font-size-xs: 0.75rem      /* 12px, labels */
--font-size-sm: 0.875rem     /* 14px, small text */
--font-size-base: 1rem       /* 16px, normal */
--font-size-lg: 1.125rem     /* 18px, medium */
--font-size-xl: 1.25rem      /* 20px, large */
--font-size-2xl: 1.5rem      /* 24px, h2 */
--font-size-3xl: 1.875rem    /* 30px, h1 */
--font-size-4xl: 2.25rem     /* 36px, hero */
```

### Font Weights

```css
--font-weight-normal: 400      /* Normal */
--font-weight-medium: 500      /* Medium */
--font-weight-semibold: 600    /* Semi-bold */
--font-weight-bold: 700        /* Bold */
```

---

## 🎭 Sistema de Sombras

```css
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 15px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 12px 50px rgba(0, 0, 0, 0.15);
```

Uso:

```css
.card {
    box-shadow: var(--shadow-md);
}

.card:hover {
    box-shadow: var(--shadow-lg);
}
```

---

## 📱 Responsive Breakpoints

Mobile-first approach. Los breakpoints están definidos en media queries:

```css
@media (min-width: 640px) {  /* Tablets pequeñas */
    ...
}

@media (min-width: 768px) {  /* Tablets */
    ...
}

@media (min-width: 1024px) { /* Laptops */
    ...
}

@media (min-width: 1280px) { /* Desktops grandes */
    ...
}
```

---

## 🌙 Dark Mode (Preparado, descomentable)

En `colors.css` hay un bloque `@media (prefers-color-scheme: dark)` listo para activar tema oscuro:

```css
@media (prefers-color-scheme: dark) {
    :root {
        --color-text-dark: #f1f5f9;
        --color-bg-page: #0f172a;
        --color-bg-card: #1e293b;
        /* ... etc */
    }
}
```

Solo **descomenta el bloque** cuando quieras activar dark mode.

---

## 🎨 Clases Utilitarias

`responsive-components.css` proporciona clases quick-fix:

### Texto
```html
<p class="text-primary">Primary color text</p>
<p class="text-dark">Dark color text</p>
<p class="text-light">Light color text</p>
```

### Fondos
```html
<div class="bg-primary">Primary bg</div>
<div class="bg-card">Card bg</div>
<div class="bg-page">Page bg</div>
```

### Bordes
```html
<div class="border-primary">Primary border</div>
<div class="border-default">Default border</div>
```

### Espacios
```html
<div class="gap-md">Flex gap: 1rem</div>
<div class="p-lg">Padding: 1.5rem</div>
<div class="m-xl">Margin: 2rem</div>
```

### Sombras
```html
<div class="shadow-sm">Shadow small</div>
<div class="shadow-lg">Shadow large</div>
```

### Esquinas
```html
<div class="rounded-md">Border radius: 8px</div>
<div class="rounded-full">Border radius: 999px</div>
```

---

## 📋 Ejemplo: Cambiar Tema a Rojo

**Paso 1:** Abre `styles/colors.css`

**Paso 2:** Cambia líneas ~5-8:

```css
:root {
    --color-primary: #ef4444;              /* ← Rojo */
    --color-primary-light: #fca5a5;        /* Rojo claro */
    --color-primary-dark: #991b1b;         /* Rojo oscuro */
    --color-secondary: #dc2626;
    --color-accent: #b91c1c;
    /* ... resto igual */
}
```

**Resultado:** Toda la app será roja automáticamente (botones, links, activos, etc).

---

## ✅ Checklist: Mejoras CSS Completadas

- ✅ Centralización de colores en `colors.css`
- ✅ Variables para espacios, tipografía, sombras, radios
- ✅ Mobile-first responsive design
- ✅ Dashboard.css refactorizado con variables
- ✅ Run/Bike/Swim tabs con mejor responsive
- ✅ Gear.css actualizado con variables
- ✅ Componentes reutilizables en `responsive-components.css`
- ✅ Clases utilitarias para quick styling
- ✅ Dark mode preparado (descomentable)
- ✅ Consistent transitions y animations

---

## 🚀 Próximos pasos

1. Actualizar más tabs (`activities.css`, `calendar.css`, `weather.css`, etc.) para usar variables
2. Agregar más gradientes predefinidos si es necesario
3. Ajustar espacios/typografía en mobile si falta feedback
4. Activar dark mode cuando el diseño lo permita

---

## 📖 Referencias Rápidas

| Quiero cambiar... | Dónde | Línea ~  |
|---|---|---|
| Color naranja principal | `colors.css` | 5 |
| Color deRunning | `colors.css` | 11 |
| Color de Ciclismo | `colors.css` | 12 |
| Tamaño de fuente base | `colors.css` | 40 |
| Padding de cards | `colors.css` | 30 |
| Radio de bordes | `colors.css` | 34 |
| Sombra de hover | `colors.css` | 25 |

---

¡Todos los cambios de color se propagan automáticamente a toda la app! 🎨✨
