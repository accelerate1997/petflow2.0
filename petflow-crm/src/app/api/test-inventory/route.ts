import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createInvoice, logStockShipment, processRefund, getProductStockLogs, adjustStock, updateProduct } from '@/lib/actions'

export async function GET() {
  const log: string[] = []

  try {
    log.push("Starting inventory, stock log, refund, and threshold tests...")

    // 1. Create a unique test product
    const testSku = `TST-PROD-${Date.now()}`
    log.push(`TC1: Creating test product with SKU: ${testSku}`)
    const product = await prisma.product.create({
      data: {
        name: "Test Shampoo Bottle",
        sku: testSku,
        category: "Shampoo",
        retail_price: 350.00,
        cost_price: 200.00,
        stock: 5,
        low_stock_threshold: 4,
        unit: "pcs"
      }
    })
    log.push(`Product created with ID: ${product.id}. Initial stock: ${product.stock}, threshold: ${product.low_stock_threshold}`)

    // 2. Perform a POS Sale that drops stock below threshold
    log.push("TC2: Creating invoice for 2 items (stock will go 5 -> 3, which is <= threshold)...")
    const invoice = await createInvoice({
      subtotal: 700.00,
      discount: 0,
      discount_type: "flat",
      tax_rate: 0,
      tax_amount: 0,
      total_amount: 700.00,
      payment_method: "Cash",
      productSales: [
        {
          productId: product.id,
          quantity: 2,
          price: 350.00
        }
      ]
    })
    log.push(`Invoice created: ${invoice.invoice_number}, Status: ${invoice.status}`)

    // Verify stock has decreased to 3
    const pAfterSale = await prisma.product.findUnique({ where: { id: product.id } })
    log.push(`Product stock after sale: ${pAfterSale?.stock} (Expected: 3)`)
    if (pAfterSale?.stock !== 3) {
      throw new Error(`Stock mismatch after sale. Got ${pAfterSale?.stock}, expected 3`)
    }

    // Verify StockLog for Sale
    const logsAfterSale = await getProductStockLogs(product.id)
    log.push(`Product stock logs after sale: ${JSON.stringify(logsAfterSale)}`)
    const saleLog = logsAfterSale.find(l => l.type === 'Sale')
    if (!saleLog || saleLog.quantity !== -2) {
      throw new Error(`Invalid or missing sale log. Got ${JSON.stringify(saleLog)}`)
    }
    log.push("Sale stock log successfully recorded.")

    // 3. Replenish stock (Log Shipment)
    log.push("TC3: Replenishing stock with 10 units at new cost_price 180.00...")
    await logStockShipment({
      productId: product.id,
      quantity: 10,
      costPrice: 180.00,
      notes: "Test replenishment order"
    })

    const pAfterReplenish = await prisma.product.findUnique({ where: { id: product.id } })
    log.push(`Product stock after replenish: ${pAfterReplenish?.stock} (Expected: 13)`)
    log.push(`Product cost price after replenish: ${pAfterReplenish?.cost_price} (Expected: 180.00)`)
    if (pAfterReplenish?.stock !== 13 || pAfterReplenish?.cost_price !== 180.00) {
      throw new Error(`Mismatch after replenish. Stock: ${pAfterReplenish?.stock}, Cost: ${pAfterReplenish?.cost_price}`)
    }

    const logsAfterReplenish = await getProductStockLogs(product.id)
    const repLog = logsAfterReplenish.find(l => l.type === 'Replenishment')
    if (!repLog || repLog.quantity !== 10 || repLog.cost_price !== 180.00) {
      throw new Error(`Invalid or missing replenishment log. Got ${JSON.stringify(repLog)}`)
    }
    log.push("Replenishment stock log successfully recorded.")

    // 4. Return & Refund items
    log.push("TC4: Processing refund for 1 item, returning it to inventory...")
    // Fetch sales for invoice to get the sale ID
    const fullInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { sales: true }
    })
    const saleItem = fullInvoice?.sales[0]
    if (!saleItem) throw new Error("Could not find sale item on invoice")

    await processRefund(invoice.id, [
      {
        saleId: saleItem.id,
        quantity: 1,
        returnToInventory: true
      }
    ])

    // Verify stock is now 14
    const pAfterRefund = await prisma.product.findUnique({ where: { id: product.id } })
    log.push(`Product stock after refund: ${pAfterRefund?.stock} (Expected: 14)`)
    if (pAfterRefund?.stock !== 14) {
      throw new Error(`Stock mismatch after refund. Got ${pAfterRefund?.stock}, expected 14`)
    }

    // Verify invoice status and total amount
    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } })
    log.push(`Invoice status after refund: ${updatedInvoice?.status} (Expected: Partially Refunded)`)
    log.push(`Invoice total amount after refund: ${updatedInvoice?.total_amount} (Expected: 350.00)`)
    if (updatedInvoice?.status !== 'Partially Refunded' || updatedInvoice?.total_amount !== 350.00) {
      throw new Error(`Invoice status or total amount mismatch. Status: ${updatedInvoice?.status}, Total: ${updatedInvoice?.total_amount}`)
    }

    // Verify StockLog for Return
    const logsAfterRefund = await getProductStockLogs(product.id)
    const returnLog = logsAfterRefund.find(l => l.type === 'Return')
    if (!returnLog || returnLog.quantity !== 1) {
      throw new Error(`Invalid or missing return log. Got ${JSON.stringify(returnLog)}`)
    }
    log.push("Return stock log successfully recorded.")

    // 5. Test Manual Stock Adjustment (adjustStock)
    log.push("TC5: Testing manual stock adjustment (adjustStock)...")
    await adjustStock(product.id, -12) // Stock goes 14 -> 2, which is <= threshold (4)
    const pAfterManualAdjust = await prisma.product.findUnique({ where: { id: product.id } })
    log.push(`Product stock after manual adjust: ${pAfterManualAdjust?.stock} (Expected: 2)`)
    if (pAfterManualAdjust?.stock !== 2) {
      throw new Error(`Stock mismatch after manual adjustment. Got ${pAfterManualAdjust?.stock}, expected 2`)
    }
    const logsAfterManualAdjust = await getProductStockLogs(product.id)
    const manualLog = logsAfterManualAdjust.find(l => l.type === 'Manual Adjustment' && l.quantity === -12)
    if (!manualLog) {
      throw new Error(`Missing manual adjustment log. Got ${JSON.stringify(logsAfterManualAdjust)}`)
    }
    log.push("Manual adjustment stock log successfully recorded.")

    // 6. Test Product Update (updateProduct)
    log.push("TC6: Testing product update (updateProduct)...")
    await updateProduct(product.id, { stock: 1 }) // Stock goes 2 -> 1, which is <= threshold (4)
    const pAfterUpdate = await prisma.product.findUnique({ where: { id: product.id } })
    log.push(`Product stock after update: ${pAfterUpdate?.stock} (Expected: 1)`)
    if (pAfterUpdate?.stock !== 1) {
      throw new Error(`Stock mismatch after update. Got ${pAfterUpdate?.stock}, expected 1`)
    }
    const logsAfterUpdate = await getProductStockLogs(product.id)
    const updateLog = logsAfterUpdate.find(l => l.type === 'Manual Adjustment' && l.quantity === -1)
    if (!updateLog) {
      throw new Error(`Missing product update log. Got ${JSON.stringify(logsAfterUpdate)}`)
    }
    log.push("Product update stock log successfully recorded.")

    // Cleanup test data
    log.push("Cleaning up test data...")
    await prisma.stockLog.deleteMany({ where: { product_id: product.id } })
    await prisma.sale.deleteMany({ where: { product_id: product.id } })
    await prisma.invoice.delete({ where: { id: invoice.id } })
    await prisma.product.delete({ where: { id: product.id } })
    log.push("Cleanup completed.")

    log.push("All tests passed successfully! ✅")
    return NextResponse.json({ success: true, log })
  } catch (err: any) {
    log.push(`Test failed with error: ${err.message}`)
    return NextResponse.json({ success: false, log, error: err.stack }, { status: 500 })
  }
}
