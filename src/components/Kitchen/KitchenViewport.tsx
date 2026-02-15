import { useState, useEffect } from 'react'
import type { KitchenGrid, KitchenEquipment } from '../../types/database.types'
import KitchenRenderer from './KitchenRenderer'

interface KitchenViewportProps {
  gridData: KitchenGrid
  equipment: KitchenEquipment[]
}

/**
 * 큰 주방에서 좌우로 스크롤하는 뷰포트 전환 시스템
 * - 소형 매장: 버튼 없이 전체 표시
 * - 대형 매장: 좌/우 이동 버튼으로 뷰포트 전환
 */
export default function KitchenViewport({ gridData, equipment }: KitchenViewportProps) {
  const [currentViewport, setCurrentViewport] = useState(0)
  const [viewportCols, setViewportCols] = useState(12)

  // 화면 너비에 따라 뷰포트 열 수 결정
  useEffect(() => {
    function calculateViewportCols() {
      const width = window.innerWidth
      if (width >= 1024) {
        // 데스크톱: 최대 12열
        setViewportCols(Math.min(12, gridData.grid_cols))
      } else if (width >= 768) {
        // 태블릿: 최대 9열
        setViewportCols(Math.min(9, gridData.grid_cols))
      } else {
        // 모바일: 최대 6열
        setViewportCols(Math.min(6, gridData.grid_cols))
      }
    }

    calculateViewportCols()
    window.addEventListener('resize', calculateViewportCols)
    return () => window.removeEventListener('resize', calculateViewportCols)
  }, [gridData.grid_cols])

  // 총 뷰포트 수
  const totalViewports = Math.ceil(gridData.grid_cols / viewportCols)

  // 캔버스 너비 비율 (뷰포트 대비)
  const canvasWidthPercent = (gridData.grid_cols / viewportCols) * 100

  // 현재 뷰포트의 translateX 값 (%)
  const translateX = -(currentViewport * viewportCols / gridData.grid_cols * 100)

  // 이전/다음 뷰포트 이동
  const goToPrev = () => {
    if (currentViewport > 0) {
      setCurrentViewport(currentViewport - 1)
    }
  }

  const goToNext = () => {
    if (currentViewport < totalViewports - 1) {
      setCurrentViewport(currentViewport + 1)
    }
  }

  const hasPrev = currentViewport > 0
  const hasNext = currentViewport < totalViewports - 1
  const showButtons = totalViewports > 1

  return (
    <div className="relative w-full">
      {/* 뷰포트 컨테이너 (overflow hidden) */}
      <div className="w-full overflow-hidden rounded-xl">
        {/* 캔버스 (전체 그리드 너비, 슬라이드 애니메이션) */}
        <div
          className="transition-transform duration-400 ease-out"
          style={{
            width: `${canvasWidthPercent}%`,
            transform: `translateX(${translateX}%)`,
          }}
        >
          <KitchenRenderer gridData={gridData} equipment={equipment} />
        </div>
      </div>

      {/* 좌측 이동 버튼 */}
      {showButtons && hasPrev && (
        <button
          onClick={goToPrev}
          className="
            absolute left-0 top-1/2 -translate-y-1/2
            w-10 h-20
            bg-white/90 hover:bg-white
            text-gray-700 text-2xl shadow-md border border-gray-200
            rounded-r-lg
            flex items-center justify-center
            transition-all
            z-10
          "
          aria-label="이전 영역"
        >
          ←
        </button>
      )}

      {/* 우측 이동 버튼 */}
      {showButtons && hasNext && (
        <button
          onClick={goToNext}
          className="
            absolute right-0 top-1/2 -translate-y-1/2
            w-10 h-20
            bg-white/90 hover:bg-white
            text-gray-700 text-2xl shadow-md border border-gray-200
            rounded-l-lg
            flex items-center justify-center
            transition-all
            z-10
          "
          aria-label="다음 영역"
        >
          →
        </button>
      )}

      {/* 뷰포트 인디케이터 (2개 이상일 때만) */}
      {showButtons && (
        <div className="flex justify-center gap-2 mt-2">
          {Array.from({ length: totalViewports }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentViewport(idx)}
              className={`
                w-2 h-2 rounded-full transition-all
                ${idx === currentViewport
                  ? 'bg-gray-700 scale-125'
                  : 'bg-gray-300 hover:bg-gray-400'}
              `}
              aria-label={`뷰포트 ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
