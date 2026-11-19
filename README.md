# SIGA Zambrano · Sistema Web de Gestión Integrada de Inventario, Ventas y Clientes

> **Prototipo Funcional en Entorno Relevante (Nivel TRL 5)**  
> **Proyecto de Grado** · Curso: **202016907** · Grupo: **202016907_2**  
> **Universidad Nacional Abierta y a Distancia (UNAD)** · **ECBTI** · **Noviembre de 2026**

---

## 📌 1. Información General del Proyecto

* **Título:** *Desarrollo de un sistema web para la gestión integrada de inventario, ventas y clientes en tiendas de abarrotes del municipio de Zambrano, Bolívar (Aplicativo SIGA Zambrano)*.
* **Municipio de Impacto:** Zambrano, Bolívar, Colombia.
* **Escuela:** Escuela de Ciencias Básicas, Tecnología e Ingeniería (ECBTI).
* **Programa Académico:** Ingeniería de Sistemas.
* **Tutor de Grado:** Orlando Gómez Barboza.
* **Autores y Roles:**
  * **Angélica María Daza Ochoa** — *Product Owner & Levantamiento de Requisitos*.
  * **Anderson David Tapia Ochoa** — *Diseñador UI/UX & Aseguramiento de la Calidad (QA)*.
  * **Carlos Guillermo Herrera Meza** — *Arquitecto de Software & Desarrollador Frontend/Cloud*.

---

## ⚖️ 2. Marco Normativo y Cumplimiento Legal Colombiano

1. **Ley 1581 de 2012 (Régimen General de Protección de Datos Personales - Habeas Data):**  
   Implementación obligatoria de consentimiento informado del titular al registrar clientes en el libro digital de fiados/créditos comerciales.
2. **Ley 527 de 1999 (Comercio Electrónico y Firmas Digitales):**  
   Generación de comprobantes de venta digitales en formato PDF con ID transaccional único (`tx.id`), estampado cronológico inmutable (timestamp) y reconocimiento probatorio de mensajes de datos.
3. **Ley 1480 de 2011 (Estatuto del Consumidor):**  
   Transparencia en precios al consumidor (menudeo y mayorista por bulto/caja), histórico detallado de abonos y cuentas de cobro claras.
4. **Norma ISO/IEC/IEEE 29148:2018 (Systems and software engineering — Life cycle processes — Requirements engineering):**  
   Especificación y validación formal de requisitos funcionales y no funcionales para micro-negocios minoristas.

---

## 🏛️ 3. Arquitectura Tecnológica (Serverless Cloud & Edge)

* **Frontend:** React 18, TypeScript 5, Vite 5.
* **Estilos & Animaciones:** Tailwind CSS 3.4 (Mobile-First, modo oscuro dinámico), Lucide React, Motion.
* **Backend BaaS & Cloud:** Firebase v12 (Modular SDK).
  * **Cloud Firestore:** Base de datos documental NoSQL multi-región con seguridad granular en `firestore.rules`.
  * **Persistencia Offline Nativa:** `initializeFirestore` con `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` respaldada en IndexedDB del navegador, garantizando operatividad ininterrumpida ante caídas de conectividad rural y sincronización bidireccional automática.
  * **Firebase Authentication:** Gestión de sesiones segura con persistencia local por dispositivo.
* **Periféricos & Hardware:**
  * **Escaneo Óptico por Cámara:** Integración de `html5-qrcode` para lectura rápida de códigos de barras (EAN-13, UPC) y códigos QR propios.
  * **Generación de Documentos:** `jspdf`, `jspdf-autotable` y `qrcode` para impresión de tirillas térmicas y planillas de códigos QR individuales y por lote.
  * **Analítica & Reportes:** `recharts` para proyección de utilidades y `xlsx` para auditoría contable.

---

## 👥 4. Control de Acceso Basado en Roles (RBAC) y Seguridad HTTP 403

El sistema implementa dos perfiles de acceso claramente diferenciados para proteger la privacidad financiera del propietario:

| Característica / Capacidad | Rol: Administrador | Rol: Dependiente |
| :--- | :---: | :---: |
| **Ventas POS (Efectivo y Fiado)** | ✅ Permitido | ✅ Permitido |
| **Consulta de Inventario y Precios** | ✅ Permitido | ✅ Permitido |
| **Entrada de Mercancía / Stock** | ✅ Permitido | ✅ Permitido |
| **Alertas de Caducidad (Perecederos)** | ✅ Permitido | ✅ Permitido |
| **Cobro por WhatsApp (Ley 1581)** | ✅ Permitido | ✅ Permitido |
| **Modificación de Costos de Compra** | ✅ Permitido | 🚫 Bloqueado (403) |
| **Ajuste de Márgenes de Utilidad** | ✅ Permitido | 🚫 Bloqueado (403) |
| **Eliminación de Productos** | ✅ Permitido | 🚫 Bloqueado (403) |
| **Anulación de Transacciones del Historial** | ✅ Permitido | 🚫 Bloqueado (403) |
| **Registro de Gastos Administrativos** | ✅ Permitido | 🚫 Bloqueado (403) |
| **Acceso a Reportes Financieros y Utilidades** | ✅ Permitido | 🚫 Bloqueado (**Error 403**) |

> **PIN Demostrativo de Elevación a Administrador:** `2026`.

---

## 📦 5. Módulos Funcionales

1. **Inventario Inteligente con Caducidad:**
   * Clasificación por categorías: *Abarrotes*, *Lácteos y Refrigerados*, *Bebidas*, *Panadería*, *Aseo Hogar*, *Cuidado Personal*, *Snacks y Dulces*, *General*.
   * Fechas de vencimiento con semáforo cromático: Rojo (vencido o $\le 7$ días), Amarillo ($\le 30$ días) y Verde ($> 30$ días).
   * Soporte bimodal: venta al menudeo (Und, Libra, Kg) y venta por mayor (Bulto, Paca, Caja, Display).
   * Generación y descarga de códigos QR para estantería.
2. **Punto de Venta (POS) & Carrito:**
   * Venta rápida con teclado táctil, cálculo de cambio y vuelto en denominaciones colombianas.
   * Descuento atómico de existencias con `writeBatch` en Firestore.
3. **Control de Fiados y Cartera:**
   * Consentimiento explícito de datos conforme a la Ley 1581 de 2012.
   * Mensajería de cobro amistoso con apertura directa de WhatsApp (`wa.me`).
4. **Reportes y Cierre Contable:**
   * Margen de utilidad bruta y neta descontando costos de mercancía vendida y gastos operativos.
   * Generación de comprobante electrónico térmico válido bajo Ley 527 de 1999.

---

## 🚀 6. Instalación y Ejecución Local

### Prerrequisitos
* Node.js $\ge$ 18.x
* npm $\ge$ 9.x

### Pasos
```bash
# 1. Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd sistema-web-abarrotes-zambrano

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor de desarrollo Vite
npm run dev

# 4. Construir para producción
npm run build

# 5. Previsualizar compilación de producción
npm run preview
```

---

## 📄 7. Licencia y Derechos Académicos

Este software fue desarrollado con fines exclusivamente académicos e investigativos en el marco del **Proyecto de Grado** para optar al título de **Ingeniero de Sistemas** en la **Universidad Nacional Abierta y a Distancia (UNAD)**. Todos los derechos morales pertenecen a los autores.
