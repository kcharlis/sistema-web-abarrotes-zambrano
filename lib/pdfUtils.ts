import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction } from '../types';

export const generateInvoicePDF = (tx: Transaction) => {
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 160] // Formato de tirilla térmica
    });

    const formatMoney = (amount: number) => 
        '$ ' + amount.toLocaleString('es-CO');

    const formatDate = (timestamp: number) => 
        new Date(timestamp).toLocaleDateString('es-CO', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric',
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        });

    // Encabezado
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("SIGA Zambrano", 40, 10, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("COMPROBANTE DE VENTA ELECTRÓNICO", 40, 15, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(`ID Transacción: ${tx.id}`, 40, 19, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha y Hora: ${formatDate(tx.date)}`, 40, 23, { align: 'center' });

    // Tabla de ítems
    const tableData = tx.items?.map(item => [
      item.name,
      item.quantity.toString(),
      formatMoney(item.price * item.quantity).replace('$', '')
    ]) || [['Venta General', '1', formatMoney(tx.amount).replace('$', '')]];

    autoTable(doc, {
      startY: 26,
      head: [['ITEM', 'CANT', 'VALOR']],
      body: tableData,
      theme: 'plain',
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fontStyle: 'bold', lineWidth: 0.1 },
      margin: { left: 5, right: 5 }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL (COP): ${formatMoney(tx.amount)}`, 75, finalY, { align: 'right' });

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "italic");
    doc.text("Mensaje de datos válido - Ley 527 de 1999", 40, finalY + 8, { align: 'center' });
    doc.text("Estatuto del Consumidor - Ley 1480 de 2011", 40, finalY + 12, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("¡GRACIAS POR SU COMPRA!", 40, finalY + 18, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.text("Zambrano, Bolívar · Comercio Local", 40, finalY + 22, { align: 'center' });

    // Metadata
    const shortTxId = tx.id ? (tx.id.length > 8 ? tx.id.slice(-8) : tx.id) : 'TX';
    doc.setProperties({
        title: `Comprobante_SIGA_${shortTxId}.pdf`,
        subject: 'Comprobante de Venta - SIGA Zambrano',
        author: 'SIGA Zambrano - UNAD'
    });

    doc.save(`Comprobante_SIGA_${shortTxId}.pdf`);
};
