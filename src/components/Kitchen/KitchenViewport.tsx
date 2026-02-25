import { useState, useEffect, useCallback } from 'react'
import type { KitchenGrid, KitchenEquipment } from '../../types/database.types'
import KitchenRenderer from './KitchenRenderer'

interface KitchenViewportProps {
  gridData: KitchenGrid
  equipment: KitchenEquipment[]
}

/**
 * 슬라이딩 윈도우 방식 주방 뷰포트
 * - 수평/수직 모두 겹치면서 이동 (예: 1-11 → 4-14)
 * - 이동 단위: 뷰포트의 약 30% (3~4칸씩)
 * - 소형 매장: 버튼 없이 전체 표시
 */
export default function KitchenViewport({ gridData, equipment }: KitchenViewportProps) {
  const [offsetCol, setOffsetCol] = useState(0)
  const [offsetRow, setOffsetRow] = useState(0)
  const [viewportCols, setViewportCols] = useState(12)
  const [viewportRows, setViewportRows] = useState(8)

  // 화면 크기에 따라 뷰포트 열/행 수 결정
  useEffect(() => {
    function calculateViewport() {
      const width = window.innerWidth
      if (width >= 1024) {
        setViewportCols(Math.min(12, gridData.grid_cols))
        setViewportRows(Math.min(8, gridData.grid_rows))
      } else if (width >= 768) {
        setViewportCols(Math.min(9, gridData.grid_cols))
        setViewportRows(Math.min(6, gridData.grid_rows))
      } else {
        setViewportCols(Math.min(6, gridData.grid_cols))
        setViewportRows(Math.min(5, gridData.grid_rows))
      }
    }

    calculateViewport()
    window.addEventListener('resize', calculateViewport)
    return () => window.removeEventListener('resize', calculateViewport)
  }, [gridData.grid_cols, gridData.grid_rows])

  // offset 범위 보정 (뷰포트 크기 변경 시)
  useEffect(() => {
    const maxCol = Math.max(0, gridData.grid_cols - viewportCols)
    const maxRow = Math.max(0, gridData.grid_rows - viewportRows)
    if (offsetCol > maxCol) setOffsetCol(maxCol)
    if (offsetRow > maxRow) setOffsetRow(maxRow)
  }, [viewportCols, viewportRows, gridData.grid_cols, gridData.grid_rows, offsetCol, offsetRow])

  // 이동 단위: 뷰포트의 약 30% (최소 1)
  const stepCol = Math.max(1, Math.round(viewportCols * 0.3))
  const stepRow = Math.max(1, Math.round(viewportRows * 0.3))

  // 최대 오프셋
  const maxOffsetCol = Math.max(0, gridData.grid_cols - viewportCols)
  const maxOffsetRow = Math.max(0, gridData.grid_rows - viewportRows)

  // 이동 함수
  const moveLeft = useCallback(() => {
    setOffsetCol(prev => Math.max(0, prev - stepCol))
  }, [stepCol])

  const moveRight = useCallback(() => {
    setOffsetCol(prev => Math.min(maxOffsetCol, prev + stepCol))
  }, [stepCol, maxOffsetCol])

  const moveUp = useCallback(() => {
    setOffsetRow(prev => Math.max(0, prev - stepRow))
  }, [stepRow])

  const moveDown = useCallback(() => {
    setOffsetRow(prev => Math.min(maxOffsetRow, prev + stepRow))
  }, [stepRow, maxOffsetRow])

  // 표시 여부
  const showHorizontal = gridData.grid_cols > viewportCols
  const showVertical = gridData.grid_rows > viewportRows

  const canLeft = offsetCol > 0
  const canRight = offsetCol < maxOffsetCol
  const canUp = offsetRow > 0
  const canDown = offsetRow < maxOffsetRow

  // transform 계산
  const translateX = gridData.grid_cols > 0
    ? -(offsetCol / gridData.grid_cols * 100)
    : 0
  const translateY = gridData.grid_rows > 0
    ? -(offsetRow / gridData.grid_rows * 100)
    : 0

  // 캔버스 크기 비율 (전체 그리드 대비)
  const canvasWidthPercent = (gridData.grid_cols / viewportCols) * 100
  const canvasHeightPercent = (gridData.grid_rows / viewportRows) * 100

  // 스크롤바 위치/크기 (수평)
  const hThumbWidth = viewportCols / gridData.grid_cols * 100
  const hThumbLeft = offsetCol / gridData.grid_cols * 100

  // 스크롤바 위치/크기 (수직)
  const vThumbHeight = viewportRows / gridData.grid_rows * 100
  const vThumbTop = offsetRow / gridData.grid_rows * 100

  return (
    <div className="relative w-full">
      {/* 뷰포트 컨테이너 */}
      <div className="w-full overflow-hidden rounded-xl" style={{
        aspectRatio: `${viewportCols} / ${viewportRows}`,
      }}>
        {/* 캔버스 (전체 그리드, 슬라이드 애니메이션) */}
        <div
          className="transition-transform duration-400 ease-out"
          style={{
            width: `${canvasWidthPercent}%`,
            height: `${canvasHeightPercent}%`,
            transform: `translate(${translateX}%, ${translateY}%)`,
          }}
        >
          <KitchenRenderer gridData={gridData} equipment={equipment} />
        </div>
      </div>

      {/* 좌측 이동 버튼 */}
      {showHorizontal && canLeft && (
        <button
          onClick={moveLeft}
          className="
            absolute left-0 top-1/2 -translate-y-1/2
            w-9 h-16
            bg-white/80 hover:bg-white
            text-gray-600 text-xl shadow-md border border-gray-200
            rounded-r-lg
            flex items-center justify-center
            transition-all
            z-10
          "
          aria-label="왼쪽 이동"
        >
          ←
        </button>
      )}

      {/* 우측 이동 버튼 */}
      {showHorizontal && canRight && (
        <button
          onClick={moveRight}
          className="
            absolute right-0 top-1/2 -translate-y-1/2
            w-9 h-16
            bg-white/80 hover:bg-white
            text-gray-600 text-xl shadow-md border border-gray-200
            rounded-l-lg
            flex items-center justify-center
            transition-all
            z-10
          "
          aria-label="오른쪽 이동"
        >
          →
        </button>
      )}

      {/* 위로 이동 버튼 */}
      {showVertical && canUp && (
        <button
          onClick={moveUp}
          className="
            absolute top-0 left-1/2 -translate-x-1/2
            w-16 h-9
            bg-white/80 hover:bg-white
            text-gray-600 text-xl shadow-md border border-gray-200
            rounded-b-lg
            flex items-center justify-center
            transition-all
            z-10
          "
          aria-label="위로 이동"
        >
          ↑
        </button>
      )}

      {/* 아래로 이동 버튼 */}
      {showVertical && canDown && (
        <button
          onClick={moveDown}
          className="
            absolute bottom-0 left-1/2 -translate-x-1/2
            w-16 h-9
            bg-white/80 hover:bg-white
            text-gray-600 text-xl shadow-md border border-gray-200
            rounded-t-lg
            flex items-center justify-center
            transition-all
            z-10
          "
          aria-label="아래로 이동"
        >
          ↓
        </button>
      )}

      {/* 수평 스크롤 인디케이터 */}
      {showHorizontal && (
        <div className="mt-2 mx-auto rounded-full bg-gray-200 overflow-hidden"
          style={{ width: '60%', height: '4px' }}
        >
          <div
            className="h-full bg-gray-500 rounded-full transition-all duration-300"
            style={{
              width: `${hThumbWidth}%`,
              marginLeft: `${hThumbLeft}%`,
            }}
          />
        </div>
      )}

      {/* 수직 스크롤 인디케이터 */}
      {showVertical && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-gray-200 overflow-hidden"
          style={{ width: '4px', height: '50%' }}
        >
          <div
            className="w-full bg-gray-500 rounded-full transition-all duration-300"
            style={{
              height: `${vThumbHeight}%`,
              marginTop: `${vThumbTop}%`,
            }}
          />
        </div>
      )}

      {/* 위치 표시 (수평/수직 어느 쪽이든 스크롤 필요할 때) */}
      {(showHorizontal || showVertical) && (
        <div className="flex justify-center mt-1">
          <span className="text-xs text-gray-400">
            {showHorizontal && `열 ${offsetCol + 1}-${Math.min(offsetCol + viewportCols, gridData.grid_cols)}`}
            {showHorizontal && showVertical && ' / '}
            {showVertical && `행 ${offsetRow + 1}-${Math.min(offsetRow + viewportRows, gridData.grid_rows)}`}
          </span>
        </div>
      )}
    </div>
  )
}
