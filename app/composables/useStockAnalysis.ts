/**
 * State and actions of the analysis page: load, crawl, save, add a forecast year.
 */

import { ref, type Ref } from 'vue';
import type { AnalysisSheetData } from '~/spreadsheet/types';
import type { SheetEdits } from '~/composables/useAnalysisSheet';
import type { StockData } from '~/types';
import type { TradingPlan } from '~/composables/useStockDataTransform';
import { crawlStockData, fetchTradingInfo, getStockData, saveStockAnalysis } from '~/services';
import {
  buildAnalysisState, createEmptyAnalysisState, nextForecastYear, toSavePayload,
} from '~/composables/useStockDataTransform';

export type { TradingPlan } from '~/composables/useStockDataTransform';

export function useStockAnalysis(symbol: Ref<string>) {
  const toast = useToast();
  const loadingStore = useLoadingStore();

  const state = ref<AnalysisSheetData>(createEmptyAnalysisState(symbol.value));
  const savedAnalysis = ref<StockData['analysis']>(null);

  async function fetchLiveTradingInfo() {
    try {
      const response = await fetchTradingInfo(symbol.value);
      return response.success ? response.data?.tradingInfo : null;
    } catch (error) {
      console.error('Failed to fetch trading info:', error);
      return null;
    }
  }

  async function load() {
    if (!symbol.value) return;

    loadingStore.show('Đang tải dữ liệu...');
    try {
      const response = await getStockData(symbol.value);
      if (!response.success || !response.data) return;

      const tradingInfo = await fetchLiveTradingInfo();
      const today = new Date().toISOString().split('T')[0]!;

      state.value = buildAnalysisState(symbol.value, response.data, tradingInfo, today);
      savedAnalysis.value = response.data.analysis ?? null;
    } catch (error) {
      console.error(error);
    } finally {
      loadingStore.hide();
    }
  }

  /** Crawl fresh data from Vietstock. Returns true when the page should reload. */
  async function crawl(): Promise<boolean> {
    if (!symbol.value) {
      toast.add({ title: 'Lỗi', description: 'Không có mã cổ phiếu', color: 'error' });
      return false;
    }

    loadingStore.show('Đang cập nhật dữ liệu từ Vietstock...');
    try {
      const response = await crawlStockData(symbol.value);
      if (response.success) {
        toast.add({ title: 'Đã cập nhật', description: 'Crawled data successfully', color: 'success' });
        return true;
      }
      toast.add({ title: 'Lỗi', description: response.error || 'Không thể crawl dữ liệu', color: 'error' });
    } catch (error: any) {
      toast.add({ title: 'Lỗi crawl', description: error.message, color: 'error' });
    } finally {
      loadingStore.hide();
    }
    return false;
  }

  function addYear() {
    const s = state.value;
    const year = nextForecastYear(s.annualData, s.forecastYears);
    s.forecastYears.push(year);
    s.forecastQuarters.push(...['Q1', 'Q2', 'Q3', 'Q4'].map(q => `${year}_${q}`));

    toast.add({ title: 'Đã thêm năm', description: `Đã thêm năm ${year} vào bảng phân tích`, color: 'success' });
  }

  /** Apply edits read from the sheet, then save everything */
  async function save(plan: TradingPlan, edits: SheetEdits | null) {
    if (!symbol.value) {
      toast.add({ title: 'Lỗi', description: 'Vui lòng nhập mã cổ phiếu', color: 'error' });
      return;
    }

    const s = state.value;
    if (edits) {
      Object.assign(s, edits.inputs);
      if (edits.peValues) s.peScenarios = edits.peValues;
      if (edits.sharesPerQuarter) s.quarterlyData['outstandingShares'] = edits.sharesPerQuarter;
    }

    loadingStore.show('Đang lưu dữ liệu...');
    try {
      await saveStockAnalysis(toSavePayload({ ...s, symbol: symbol.value }, plan));

      toast.add({
        title: 'Đã lưu',
        description: `Kịch bản cho ${symbol.value.toUpperCase()} đã được lưu`,
        color: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'Lỗi lưu dữ liệu',
        description: error instanceof Error ? error.message : 'Lỗi không xác định',
        color: 'error',
      });
    } finally {
      loadingStore.hide();
    }
  }

  return { state, savedAnalysis, load, crawl, addYear, save };
}
