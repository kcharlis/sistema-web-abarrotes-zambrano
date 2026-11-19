# Manual de Usuario y Documentación Técnica · SIGA Zambrano

**Sistema web para la gestión integrada de inventario, ventas y clientes en tiendas de abarrotes del municipio de Zambrano, Bolívar**

> **Nivel de Madurez:** Prototipo Funcional en Entorno Relevante (TRL 5)  
> **Curso:** Proyecto de Grado (Código: 202016907) · **Grupo Colaborativo:** 202016907_2  
> **Programa:** Ingeniería de Sistemas · **Escuela:** ECBTI · **Centro:** CEAD Plato (ZCAR)  
> **Institución:** Universidad Nacional Abierta y a Distancia (UNAD)  
> **Fecha:** Noviembre de 2026  

---

## 👥 Equipo del Proyecto y Autoría

* **Autores e Investigadores:**
  * **Angélica María Daza Ochoa** — *Product Owner & Levantamiento de Requisitos*.
  * **Anderson David Tapia Ochoa** — *Diseñador UI/UX & Aseguramiento de Calidad (QA)*.
  * **Carlos Guillermo Herrera Meza** — *Arquitecto de Software & Desarrollador Frontend/Cloud*.
* **Tutor de Proyecto de Grado:** **Orlando Gómez Barboza**.

---

## 📋 1. Introducción y Contexto Operativo

El aplicativo **SIGA Zambrano** es un prototipo funcional validado en entorno simulado y relevante (nivel TRL 5), concebido para responder a las necesidades reales de digitalización, control de inventario, facturación POS y seguimiento de cartera (fiados) en las tiendas de abarrotes del municipio de **Zambrano, Bolívar**.

El sistema sustituye las libretas físicas de papel y los cálculos manuales por una interfaz web responsiva (*Mobile-First*), capaz de operar sin conexión a internet (*Offline First*) y sincronizarse de manera automática e inmutable con la nube cuando se restablece la conectividad.

---

## ⚖️ 2. Marco Normativo y Cumplimiento Legal

1. **Ley 1581 de 2012 (Protección de Datos Personales / Habeas Data):**  
   Al registrar nuevos clientes en el módulo de fiados o en la venta a crédito, se exige la casilla de verificación obligatoria de autorización informada del cliente para el almacenamiento de sus datos de contacto y cuentas por cobrar.
2. **Ley 527 de 1999 (Comercio Electrónico y Mensajes de Datos):**  
   Los comprobantes de venta emitidos en PDF poseen validez jurídica probatoria como mensajes de datos, incorporando identificador transaccional único (`tx.id`), fecha y hora exacta con precisión de segundos, y desglose en pesos colombianos (COP).
3. **Ley 1480 de 2011 (Estatuto del Consumidor):**  
   Transparencia en precios a la vista para unidades individuales y presentaciones mayoristas (bulto, paca, caja), además de un historial fidedigno de abonos parciales.
4. **Norma ISO/IEC/IEEE 29148:2018 (Ingeniería de Requisitos):**  
   Desarrollo estructurado a partir del levantamiento formal de requisitos funcionales y no funcionales para micro-negocios minoristas.

---

## 🔐 3. Control de Acceso por Roles (RBAC) y Seguridad HTTP 403

El sistema implementa dos roles de operación definidos para resguardar la información financiera sensible del negocio:

* **Administrador (`admin`):** Propietario de la tienda de abarrotes. Acceso total a márgenes de ganancia, costos de adquisición de proveedores, auditoría contable, reportes y eliminación de registros.
* **Dependiente (`dependiente`):** Empleado o cajero de mostrador. Autorizado para ventas POS, entrada de mercancía, consulta de existencias y registro de fiados. **No puede** visualizar reportes financieros, modificar costos ni anular transacciones.

### Mecanismos de Seguridad Implementados:
1. **Selector de Rol Inicial:** En la pantalla de autenticación ([AuthScreen.tsx](file:///d:/Disco%20D/Curso/UNAD/Cursos/PROYECTO%20DE%20GRADO/Fase%204%20-%20Componente%20Practico%20-%20Practica%20Simulada/03%20-%20Evidencias/sistema-web-abarrotes-zambrano/components/AuthScreen.tsx)), el usuario elige su rol antes de ingresar.
2. **Badge de Rol en Header:** Informa visualmente `Rol: Admin` o `Rol: Dependiente`.
3. **Elevación de Privilegios mediante PIN:** Para cambiar de rol `dependiente` a `admin`, se solicita un PIN de seguridad demostrativo:
   $$\text{PIN de Administrador: } \mathbf{2026}$$
4. **Bloqueo HTTP 403 en Reportes:** Si el dependiente pulsa la pestaña de *Reportes*, el sistema bloquea la vista desplegando una pantalla de **Acceso Denegado (Error 403)**, ofreciendo volver al inicio o introducir el PIN.
5. **Bloqueo en Inventario y Finanzas:**
   * Modificación de costos y márgenes de ganancia restringidos únicamente al Administrador.
   * Eliminación de productos del catálogo bloqueada para dependientes.
   * Anulación de transacciones del historial bloqueada para dependientes.
   * Registro de gastos administrativos bloqueado para dependientes.

---

## 📦 4. Módulos y Funcionalidades del Sistema

### 4.1. Mi Inventario y Almacén
* **Categorización Estructurada:** Clasificación rápida por 13 líneas comerciales propias de una tienda de abarrotes colombiana:
  1. *Abarrotes*
  2. *Granos y Cereales*
  3. *Condimentos y Salsas*
  4. *Aceites y Enlatados*
  5. *Lácteos y Refrigerados*
  6. *Carnes y Embutidos*
  7. *Bebidas*
  8. *Panadería*
  9. *Snacks y Dulces*
  10. *Frutas y Verduras*
  11. *Aseo Hogar*
  12. *Cuidado Personal*
  13. *General*
* **Barra de Filtro Rápido:** Acceso inmediato con botones tipo píldora y scroll horizontal para filtrar el inventario por categoría con un solo toque. Muestra las 13 categorías estándar y añade automáticamente cualquier categoría personalizada que ya esté registrada en los productos del tendero.
* **Fechas de Vencimiento y Perecederos:** Campo de fecha (`YYYY-MM-DD`) con semáforo cromático dinámico:
  * 🔴 **Rojo:** Producto vencido o con vencimiento crítico ($\le 7$ días).
  * 🟡 **Amarillo:** Producto con vencimiento próximo ($\le 30$ días).
  * 🟢 **Verde/Neutro:** Producto con margen seguro ($> 30$ días).
* **Banner de Alertas Operativas:** Notificación superior automática con el conteo de existencias bajo stock mínimo y productos próximos a caducar.
* **Precios Bimodales (Menudeo y Mayorista):** Manejo simultáneo de costo y precio por unidad y por empaque mayorista (Bulto, Paca, Caja, Display, Saco, Garrafa).
* **Escaneo y Generación de Códigos QR/Barras:** Escaneo por cámara web/móvil con `barcode-detector` (ZXing-C++ WebAssembly) y exportación de etiquetas para estantes en formato PDF con la nomenclatura `SIGA Zambrano - [Unidad]`.

### 4.2. Ventas POS y Calculadora
* **Terminal POS Ágil:** Búsqueda rápida por nombre o escaneo óptico del código de barras.
* **Cálculo de Cambio y Billetes:** Desglose del cambio a entregar con botones de denominaciones colombianas (\$2k, \$5k, \$10k, \$20k, \$50k, \$100k).
* **Descuento Atómico de Inventario:** Ejecución mediante lotes transaccionales (`writeBatch`) en Cloud Firestore para evitar inconsistencias de existencias.
* **Comprobante Digital (Ley 527):** Generación instantánea de factura térmica en PDF descargable con ID transaccional único y nota de conformidad legal.

### 4.3. Control de Fiados (Cartera y Deudores)
* **Consentimiento Ley 1581 de 2012:** Formulario con casilla obligatoria de autorización de tratamiento de datos personales para todo cliente nuevo.
* **Semáforo de Riesgo:** Indicador de mora y deuda (Verde: al día; Amarillo: alerta; Rojo: riesgo alto).
* **Cobro Amigable por WhatsApp:** Botón que abre una conversación con mensaje cordial precargado y saldo adeudado (`wa.me`).
* **Historial Inmutable de Abonos:** Registro fecha a fecha de los pagos recibidos con recalculación automática del saldo pendiente.

### 4.4. Resumen Diario y Reportes Financieros
* **Balance de Hoy:** Cálculo automático de balance neto:
  $$\text{Saldo Total} = \text{Ventas} - \text{Gastos Operativos}$$
* **Márgenes de Utilidad:** Desglose entre costo de mercancía vendida (CMV), utilidad bruta y utilidad neta.
* **Planilla General de Inventario:** Exportación en PDF con valoración total de activos y utilidades proyectadas.

---

## 🌐 5. Persistencia Offline y Resiliencia en Red Rural

SIGA Zambrano está adaptado a las condiciones de conectividad intermitente del municipio de Zambrano mediante:
* **IndexedDB Local:** La caché estructurada almacena inventarios, deudores y transacciones localmente con `persistentLocalCache` y `persistentMultipleTabManager`.
* **Sincronización Bidireccional:** Al detectar reconexión, las transacciones pendientes se sincronizan automáticamente con Firebase Cloud Firestore sin requerir intervención del usuario.
* **Modo Offline Invitado:** Modo de exploración local para operar en contingencia sin requerir autenticación externa.

---

## 🛠️ 6. Guía de Ejecución y Despliegue

```bash
# 1. Instalar dependencias del proyecto
npm install

# 2. Ejecutar chequeo estático de tipos TypeScript
npx tsc --noEmit

# 3. Iniciar servidor de desarrollo local
npm run dev

# 4. Compilar paquete optimizado para producción
npm run build
```

---

*Documento técnico elaborado conforme a los entregables de la Fase 4 (Componente Práctico - Práctica Simulada) del Proyecto de Grado 202016907_2, Universidad Nacional Abierta y a Distancia (UNAD), Noviembre de 2026.*
