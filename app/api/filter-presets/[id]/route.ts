import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const filterPresetSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  filters: z.string().optional(), // JSON string
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const presetId = params.id
    const body = await request.json()
    const data = filterPresetSchema.parse(body)

    // Verify ownership
    const preset = await prisma.filterPreset.findUnique({
      where: { id: presetId },
    })

    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    if (preset.userId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Validate filters JSON if provided
    if (data.filters) {
      try {
        JSON.parse(data.filters)
      } catch {
        return NextResponse.json(
          { error: 'Invalid filters JSON' },
          { status: 400 }
        )
      }
    }

    const updateData: any = {}
    if (data.name) updateData.name = data.name.trim()
    if (data.filters) updateData.filters = data.filters

    const updated = await prisma.filterPreset.update({
      where: { id: presetId },
      data: updateData,
    })

    return NextResponse.json({
      preset: {
        ...updated,
        filters: JSON.parse(updated.filters),
        created_at: updated.created_at.toISOString(),
        updated_at: updated.updated_at.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating filter preset:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const presetId = params.id

    // Verify ownership
    const preset = await prisma.filterPreset.findUnique({
      where: { id: presetId },
    })

    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    if (preset.userId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    await prisma.filterPreset.delete({
      where: { id: presetId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting filter preset:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

