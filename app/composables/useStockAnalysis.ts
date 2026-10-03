/**
 * State and actions of the analysis page: load, crawl, save, add a forecast year,
 * reset unsaved changes.
 */

import { ref, type Ref } from 'vue';
import type { AnalysisSheetData } from '~/spreadsheet/types';
import type { SheetEdits } from '~/composables/useAnalysisSheet';
import type { StockData } from '~/types';
import type { TradingPlan } from '~/composables/useStockDataTransform';
import { crawlStockData, fetchTradingInfo, getStockData, saveStockAnalysis } from '~/services';
import {
  buildAnalysisState, createEmptyAnalysisState, nextForecastYear, sharesOverrides, toSavePayload,
} from '~/composables/useStockDataTransform';

export type { TradingPlan } from '~/composables/useStockDataTransform';

const NO_PLAN: TradingPlan = { noteHtml: '', entryPrice: null, targetPrice: null, stopLoss: null };

export function useStockAnalysis(symbol: Ref<string>) {
  const toast = useToast();
  const loadingStore = useLoadingStore();

  const state = ref<AnalysisSheetData>(createEmptyAnalysisState(symbol.value));
  const savedAnalysis = ref<StockData['analysis']>(null);
  const isLoading = ref(false);
  // State as loaded or last saved, for "Đặt lại" (plain JSON, so a deep copy is safe)
  const copy = (s: AnalysisSheetData): AnalysisSheetData => JSON.parse(JSON.stringify(s));
  let savedState = copy(state.value);
  const keepSavedState = () => {
    savedState = copy(state.value);
  };

  async function fetchLiveTradingInfo() {
    try {
      const response = await fetchTradingInfo(symbol.value);
      return response.success ? response.data?.tradingInfo : null;
    } catch (error) {
      console.error('Failed to fetch trading info:', error);
      return null;
    }
  }

  /**
   * Load the stock. With `keepInputs` (after a crawl) the figures are the new
   * ones but the assumptions, overrides and added years the user has not
   * saved yet are kept; "Đặt lại" still goes back to the saved analysis.
   */
  async function load(options: { keepInputs?: boolean } = {}) {
    if (!symbol.value) return;

    loadingStore.show('Đang tải dữ liệu...');
    isLoading.value = true;
    try {
      const response = await getStockData(symbol.value);
      if (!response.success || !response.data) return;

      const tradingInfo = await fetchLiveTradingInfo();
      const today = new Date().toISOString().split('T')[0]!;

      const loaded = buildAnalysisState(symbol.value, response.data, tradingInfo, today);
      savedState = copy(loaded);
      if (options.keepInputs) {
        // The current inputs, read back as if they had been saved
        const { symbol: _symbol, forecastYears, ...inputs } = toSavePayload(state.value, NO_PLAN);
        const kept = buildAnalysisState(symbol.value, {
          ...response.data,
          analysis: { ...response.data.analysis, ...inputs },
        }, tradingInfo, today);
        for (const year of forecastYears) {
          if (!kept.forecastYears.includes(year)) kept.forecastYears.push(year);
        }
        state.value = kept;
      } else {
        state.value = loaded;
      }
      savedAnalysis.value = response.data.analysis ?? null;
    } catch (error) {
      console.error(error);
    } finally {
      isLoading.value = false;
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
        toast.add({ title: 'Đã cập nhật', description: 'Đã tải số liệu mới nhất từ Vietstock', color: 'success' });
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
    if (Object.keys(s.annualData).length === 0 && Object.keys(s.quarterlyData).length === 0) {
      toast.add({ title: 'Chưa có dữ liệu', description: 'Đợi tải xong dữ liệu rồi thêm năm', color: 'warning' });
      return;
    }
    const year = nextForecastYear(s.annualData, s.quarterlyData, s.forecastYears);
    s.forecastYears.push(year);
    s.forecastQuarters.push(...['Q1', 'Q2', 'Q3', 'Q4'].map(q => `${year}_${q}`));

    toast.add({ title: 'Đã thêm năm', description: `Đã thêm năm ${year} vào bảng phân tích`, color: 'success' });
  }

  /** Apply edits read from the sheet, then save everything. Returns true when saved. */
  async function save(plan: TradingPlan, edits: SheetEdits | null): Promise<boolean> {
    if (!symbol.value) {
      toast.add({ title: 'Lỗi', description: 'Vui lòng nhập mã cổ phiếu', color: 'error' });
      return false;
    }

    const s = state.value;
    if (edits) {
      Object.assign(s, edits.inputs);
      if (edits.peValues) s.peScenarios = edits.peValues;
      // Only the counts the user typed: the others keep following their
      // defaults (derived per quarter, or the current outstanding shares)
      if (edits.sharesPerQuarter) {
        s.quarterlyData['outstandingShares'] = sharesOverrides(edits.sharesPerQuarter, s.quarterlyData, s.outstandingShares) ?? {};
      }
    }

    loadingStore.show('Đang lưu dữ liệu...');
    try {
      const payload = toSavePayload({ ...s, symbol: symbol.value }, plan);
      await saveStockAnalysis({ ...payload, forecast: edits?.forecast });
      // The summary bar shows the saved trading plan
      const { symbol: _symbol, forecastYears: _forecastYears, ...saved } = payload;
      savedAnalysis.value = saved;
      keepSavedState();

      toast.add({
        title: 'Đã lưu',
        description: `Kịch bản cho ${symbol.value.toUpperCase()} đã được lưu`,
        color: 'success',
      });
      return true;
    } catch (error) {
      toast.add({
        title: 'Lỗi lưu dữ liệu',
        description: error instanceof Error ? error.message : 'Lỗi không xác định',
        color: 'error',
      });
    } finally {
      loadingStore.hide();
    }
    return false;
  }

  /** Back to the state as loaded or last saved (assumptions, sheet edits, added years) */
  function reset() {
    state.value = copy(savedState);
  }

  return { state, savedAnalysis, isLoading, load, crawl, addYear, save, reset };
}
