import { supabaseAdmin } from '../../lib/Connections/supabase';
import { z } from 'zod';
import { createTRPCRouter, tenantProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export interface settings {
  Description: string | null;
  Industry: string | null;
  Setting_id: number;
  Tenant_Id: string | null;
}

const DEFAULT_SETTINGS = {
  Description: '',
  Industry: '',
};

export function buildSystemPrompt(settings: settings): string {
  const basePrompt = `You are a helpful AI assistant specialized in business and POS (Point of Sale) systems.`;

  const industryPart = settings.Industry
    ? ` Your primary industry focus is: ${settings.Industry}.`
    : '';

  const descriptionPart = settings.Description
    ? ` Additional context: ${settings.Description}.`
    : '';

  return (
    basePrompt +
    industryPart +
    descriptionPart +
    `\n\nAlways provide clear, actionable steps and ask clarifying questions when needed. Be friendly, professional, and focus on practical solutions.`
  );
}

export const settingsRouter = createTRPCRouter({
  fetch: tenantProcedure.query(async ({ ctx }) => {
    if (!ctx.user.tenant_id) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Tenant ID is required',
      });
    }

    try {
      const { data, error } = await ctx.supabaseAdmin
        .from('settings')
        .select('*')
        .eq('tenant_id', ctx.user.tenant_id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching settings:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      // If no settings exist, create default settings
      if (!data) {
        const { data: newSettings, error: createError } = await supabaseAdmin
          .from('settings')
          .insert({
            tenant_id: ctx.user.tenant_id,
            description: DEFAULT_SETTINGS.Description,
            industry: DEFAULT_SETTINGS.Industry,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating default settings:', createError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: createError.message,
          });
        }

        return {
          Description: newSettings.description,
          Industry: newSettings.industry,
          Setting_id: Number(newSettings.setting_id),
          Tenant_Id: newSettings.tenant_id,
        };
      }

      return {
        Description: data.description,
        Industry: data.industry,
        Setting_id: Number(data.setting_id),
        Tenant_Id: data.tenant_id,
      };
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
      });
    }
  }),

  save: tenantProcedure
    .input(
      z.object({
        Description: z.string().nullish(),
        Industry: z.string().nullish(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        if (!ctx.user.tenant_id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Tenant ID is required',
          });
        }
        // Use update instead of upsert to avoid duplicates
        const { data: existing } = await supabaseAdmin
          .from('settings')
          .select('setting_id')
          .eq('tenant_id', ctx.user.tenant_id)
          .single();

        if (existing) {
          // Update existing settings
          const { error } = await supabaseAdmin
            .from('settings')
            .update({
              description: input.Description,
              industry: input.Industry,
            })
            .eq('setting_id', existing.setting_id);

          if (error) {
            console.error('Error updating settings:', error);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error.message,
            });
          }
        } else {
          // Create new settings if they don't exist
          const { error } = await supabaseAdmin.from('settings').insert({
            tenant_id: ctx.user.tenant_id,
            description: input.Description,
            industry: input.Industry,
          });

          if (error) {
            console.error('Error creating settings:', error);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error.message,
            });
          }
        }

        return { success: true };
      } catch (error: any) {
        console.error('Error in save settings:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to save settings',
        });
      }
    }),
});