import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { InspectionReport, ParameterStatus } from '../types';

const generatePrintableHtml = (report: InspectionReport): string => {
  const signaturesHtml = Object.entries(report.signatures)
    .filter(([, sig]) => sig.signed)
    .map(([role, sig]) => `
      <div class="signature">
        <p><strong>${role}:</strong> Signed</p>
        <p><strong>Timestamp:</strong> ${new Date(sig.timestamp!).toLocaleString()}</p>
        ${sig.comment ? `<p class="comment"><em>"${sig.comment}"</em></p>` : ''}
      </div>
    `).join('');

  return `
    <div id="pdf-content" style="font-family: Arial, sans-serif; color: #333; background-color: white; padding: 20px; width: 210mm; font-size: 10px;">
      <style>
        #pdf-content h1, #pdf-content h2 { color: #005f73; border-bottom: 1px solid #dee2e6; padding-bottom: 5px; }
        #pdf-content .header { text-align: center; margin-bottom: 20px; }
        #pdf-content .header h1 { margin: 0; }
        #pdf-content .header p { margin: 0; color: #6c757d; }
        #pdf-content .section { margin-bottom: 15px; }
        #pdf-content .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 15px; }
        #pdf-content .details-grid p { margin: 0; }
        #pdf-content .details-grid strong { color: #495057; }
        #pdf-content table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 8px; }
        #pdf-content th, #pdf-content td { border: 1px solid #dee2e6; padding: 4px; text-align: left; }
        #pdf-content th { background-color: #f8f9fa; }
        #pdf-content .status-pass { color: green; }
        #pdf-content .status-fail { color: red; font-weight: bold; }
        #pdf-content .status-pending { color: grey; }
        #pdf-content .signature { border: 1px solid #ccc; padding: 8px; margin-top: 5px; border-radius: 4px; background: #f9f9f9;}
        #pdf-content .comment { font-style: italic; color: #555; }
        #pdf-content .final-status { text-align: center; font-size: 24px; font-weight: bold; padding: 15px; margin-top: 20px; border-radius: 5px; color: white; }
        #pdf-content .status-accepted { background-color: #28a745; }
        #pdf-content .status-rejected { background-color: #dc3545; }
        #pdf-content .status-rework { background-color: #ffc107; color: #333; }
        #pdf-content .status-deviation { background-color: #007bff; }
      </style>
      <div class="header">
        <h1>Qopikun Digital Inspection Report</h1>
        <p>Inspection ID: ${report.id}</p>
      </div>

      ${report.isComplete && report.finalStatus ? `
        <div class="section">
          <div class="final-status status-${report.finalStatus.split(' ')[0].toLowerCase()}">
            FINAL STATUS: ${report.finalStatus.toUpperCase()}
          </div>
        </div>
      ` : ''}

      <div class="section">
        <h2>Product Details</h2>
        <div class="details-grid">
          <p><strong>Product Name:</strong> ${report.productDetails.productName}</p>
          <p><strong>Part Number:</strong> ${report.productDetails.partNumber}</p>
          <p><strong>Drawing Number:</strong> ${report.productDetails.drawingNumber}</p>
          <p><strong>Revision:</strong> ${report.productDetails.revision}</p>
        </div>
      </div>

      <div class="section">
        <h2>Inspection Parameters</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Nominal</th>
              <th>Tolerance</th>
              <th>Actual</th>
              <th>Deviation</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${report.parameters.map(p => `
              <tr>
                <td>${p.id}</td>
                <td>${p.gdtSymbol ? `[${p.gdtSymbol}] ` : ''}${p.description}</td>
                <td>${p.nominal.toFixed(3)}</td>
                <td>${p.ltl.toFixed(3)} - ${p.utl.toFixed(3)}</td>
                <td>${p.actual?.toFixed(3) ?? 'N/A'}</td>
                <td>${p.deviation?.toFixed(3) ?? 'N/A'}</td>
                <td class="status-${p.status.toLowerCase()}">${p.status}</td>
              </tr>
              ${p.comment ? `<tr><td colspan="7" style="background: #f4f4f4;"><em><strong>Comment:</strong> ${p.comment}</em></td></tr>` : ''}
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="section">
          <h2>Evidence</h2>
          ${report.evidence.length > 0 ? report.evidence.map(e => `<p>- ${e.name} (${e.type})</p>`).join('') : '<p>No general evidence attached.</p>'}
      </div>

      <div class="section">
        <h2>Signatures</h2>
        ${signaturesHtml || '<p>No signatures recorded.</p>'}
      </div>
    </div>
  `;
};


export const generateInspectionPdf = async (report: InspectionReport) => {
  const contentHtml = generatePrintableHtml(report);
  
  // Create a temporary element to render the HTML off-screen
  const container = document.createElement('div');
  container.innerHTML = contentHtml;
  document.body.appendChild(container);
  
  const contentElement = document.getElementById('pdf-content');
  if (!contentElement) {
    console.error("PDF content element not found");
    document.body.removeChild(container);
    return;
  }

  try {
    const canvas = await html2canvas(contentElement, {
      scale: 2, // Improve resolution
      useCORS: true,
      backgroundColor: '#ffffff'
    });
    
    document.body.removeChild(container); // Clean up the temporary element
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const ratio = canvasWidth / canvasHeight;
    const imgWidth = pdfWidth;
    const imgHeight = imgWidth / ratio;
    
    let heightLeft = imgHeight;
    let position = 0;
    
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
    
    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }
    
    pdf.save(`Inspection-Report-${report.id}.pdf`);

  } catch (error) {
    console.error("Error generating PDF:", error);
    document.body.removeChild(container); // Ensure cleanup on error
  }
};
