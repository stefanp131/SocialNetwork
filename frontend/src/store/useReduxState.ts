import { useCallback, useEffect } from 'react';
import { setUiValue } from './uiStateSlice';
import { useAppDispatch, useAppSelector } from './hooks';

export function useReduxState<T>(key: string, initialValue: T): [T, (next: T | ((prev: T) => T)) => void] {
  const dispatch = useAppDispatch();
  const existingValue = useAppSelector((state) => state.ui.values[key]) as T | undefined;
  const value = existingValue === undefined ? initialValue : existingValue;

  useEffect(() => {
    if (existingValue === undefined) {
      dispatch(setUiValue({ key, value: initialValue }));
    }
  }, [dispatch, existingValue, initialValue, key]);

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    const resolved = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
    dispatch(setUiValue({ key, value: resolved }));
  }, [dispatch, key, value]);

  return [value, setValue];
}
