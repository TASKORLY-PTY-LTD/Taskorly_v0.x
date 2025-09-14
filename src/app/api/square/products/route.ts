import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { appId, secretKey } = await req.json();

  const squareRes = await fetch('https://connect.squareupsandbox.com/v2/catalog/list?types=ITEM', {
    method: 'GET',
    headers: {
      'Square-Version': '2025-08-20',
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!squareRes.ok) {
    const error = await squareRes.json();
    return NextResponse.json({ error: error.message || 'Failed to fetch from Square' }, { status: squareRes.status });
  }

  const data = await squareRes.json();

  const products = (data.objects || []).flatMap((item: any) => {
    const itemData = item.item_data || {};
    return (itemData.variations || []).map((variation: any) => {
      const varData = variation.item_variation_data || {};
      const priceMoney = varData.price_money || {};
      return {
        id: item.id,
        name: itemData.name,
        description: itemData.description || '',
        price: (priceMoney.amount || 0) / 100, 
        currency: priceMoney.currency || 'AUD',
        variationName: varData.name || '',
        isTaxable: itemData.is_taxable || false,
        isArchived: itemData.is_archived || false,
        createdAt: variation.created_at || item.created_at,
        updatedAt: variation.updated_at || item.updated_at,
      };
    });
  });

  return NextResponse.json({ products });
}